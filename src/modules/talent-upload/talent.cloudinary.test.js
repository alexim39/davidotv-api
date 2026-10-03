import { describe, it, expect, vi, beforeEach } from 'vitest';

// createUpload stores Cloudinary URLs (never local /uploads paths).

vi.mock('../../config/cloudinary.js', () => ({
  uploadBuffer: vi.fn(),
  deleteAsset: vi.fn(),
}));

vi.mock('./talent.model.js', () => ({
  TalentUploadModel: { create: vi.fn() },
}));

import { uploadBuffer } from '../../config/cloudinary.js';
import { TalentUploadModel } from './talent.model.js';
import { createUpload } from './talent.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUpload (Cloudinary)', () => {
  it('stores secure_url + publicIds, no local paths', async () => {
    uploadBuffer
      .mockResolvedValueOnce({ url: 'https://res.cloudinary.com/c/video/upload/t.mp3', publicId: 'davidotv/talent/t' })
      .mockResolvedValueOnce({ url: 'https://res.cloudinary.com/c/image/upload/cover.jpg', publicId: 'davidotv/talent/covers/c' });
    TalentUploadModel.create.mockImplementation(async (doc) => doc);

    const doc = await createUpload({
      artistName: 'A',
      title: 'T',
      genre: 'Afrobeats',
      file: { buffer: Buffer.from('audio'), mimetype: 'audio/mpeg', originalname: 't.mp3', size: 10 },
      coverFile: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', originalname: 'c.jpg', size: 5 },
      uploaderId: 'u1',
    });

    expect(uploadBuffer).toHaveBeenCalledTimes(2);
    expect(doc.fileUrl).toBe('https://res.cloudinary.com/c/video/upload/t.mp3');
    expect(doc.filePublicId).toBe('davidotv/talent/t');
    expect(doc.coverUrl).toContain('cover.jpg');
    expect(doc.fileUrl).not.toContain('/uploads/');
  });

  it('works without a cover file', async () => {
    uploadBuffer.mockResolvedValueOnce({ url: 'https://res.cloudinary.com/c/video/upload/t.mp3', publicId: 'p' });
    TalentUploadModel.create.mockImplementation(async (doc) => doc);

    const doc = await createUpload({
      artistName: 'A',
      title: 'T',
      file: { buffer: Buffer.from('audio'), mimetype: 'audio/mpeg', originalname: 't.mp3', size: 10 },
      coverFile: null,
      uploaderId: 'u1',
    });

    expect(uploadBuffer).toHaveBeenCalledTimes(1);
    expect(doc.coverUrl).toBeNull();
  });
});
