import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests with the Cloudinary SDK mocked at the module boundary —
// no credentials, no network.

vi.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';
import { uploadBuffer, deleteAsset } from './cloudinary.js';

const OLD_URL = process.env.CLOUDINARY_URL;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloud';
});

describe('uploadBuffer', () => {
  it('streams the buffer and resolves url + publicId', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((_opts, cb) => {
      const stream = { end: vi.fn((buf) => cb(null, {
        secure_url: 'https://res.cloudinary.com/cloud/video/upload/v1/x.mp3',
        public_id: 'davidotv/talent/123-x',
      })) };
      return stream;
    });

    const buf = Buffer.from('fake-audio');
    const res = await uploadBuffer(buf, { mimetype: 'audio/mpeg', filename: 'track.mp3', subfolder: 'talent' });

    expect(res.url).toContain('https://');
    expect(res.publicId).toBe('davidotv/talent/123-x');
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledOnce();
    const [opts] = cloudinary.uploader.upload_stream.mock.calls[0];
    expect(opts.resource_type).toBe('video'); // audio served under video
    expect(opts.folder).toBe('davidotv/talent');
  });

  it('maps images to the image resource type', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((_opts, cb) => ({
      end: () => cb(null, { secure_url: 'https://x/y.jpg', public_id: 'p' }),
    }));
    await uploadBuffer(Buffer.from('img'), { mimetype: 'image/jpeg', filename: 'a.jpg', subfolder: 'avatars' });
    const [opts] = cloudinary.uploader.upload_stream.mock.calls[0];
    expect(opts.resource_type).toBe('image');
  });

  it('503s when CLOUDINARY_URL is absent (fail fast, no local fallback)', async () => {
    delete process.env.CLOUDINARY_URL;
    await expect(uploadBuffer(Buffer.from('x'), { mimetype: 'audio/mpeg' }))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it('400s unsupported mimetypes', async () => {
    await expect(uploadBuffer(Buffer.from('x'), { mimetype: 'application/pdf', filename: 'd.pdf' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('502s provider failures with a safe message', async () => {
    cloudinary.uploader.upload_stream.mockImplementation((_opts, cb) => ({
      end: () => cb(new Error('quota exploded'), null),
    }));
    await expect(uploadBuffer(Buffer.from('x'), { mimetype: 'audio/mpeg' }))
      .rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('deleteAsset', () => {
  it('no-ops on empty publicId', async () => {
    await deleteAsset(null);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it('never throws the caller on provider failure', async () => {
    cloudinary.uploader.destroy.mockRejectedValue(new Error('gone'));
    await expect(deleteAsset('p', 'image')).resolves.toBeUndefined();
  });
});

// Restore (other suites assert the unconfigured path).
process.env.CLOUDINARY_URL = OLD_URL;
