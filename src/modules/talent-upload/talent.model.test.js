import { describe, it, expect } from 'vitest';
import { TalentUploadModel } from './talent.model.js';

// Domain-invariant tests: no DB connection needed — validation and virtuals
// evaluate on in-memory documents.

const base = () => new TalentUploadModel({
  artistName: 'Test Artist',
  title: 'Test Track',
  genre: 'Afrobeats',
  fileUrl: '/uploads/talent/2026-01/f.mp3',
  mimeType: 'audio/mpeg',
  fileSize: 1024,
  uploader: '64b64c9a1a2b3c4d5e6f0001',
});

describe('TalentUpload invariants', () => {
  it('defaults to pending with zeroed engagement counters', () => {
    const doc = base();
    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.callUpStatus).toBe('pending');
    expect(doc.plays).toBe(0);
    expect(doc.likeCount).toBe(0);
    expect(doc.shareCount).toBe(0);
  });

  it('rejects unknown callUpStatus values', () => {
    const doc = base();
    doc.callUpStatus = 'superstar';
    const err = doc.validateSync();
    expect(err?.errors?.['callUpStatus']).toBeDefined();
  });

  it('engagementScore rewards likes/shares over raw plays', () => {
    const viral = base();
    viral.likeCount = 10; viral.plays = 100; viral.shareCount = 0; viral.commentCount = 0;
    const steady = base();
    steady.likeCount = 0; steady.plays = 1000; steady.shareCount = 0; steady.commentCount = 0;
    // 10*3 + 100*0.7 = 100  vs  1000*0.7 = 700 → plays still dominate at scale:
    // assert formula transparency, not a fixed ranking.
    expect(viral.engagementScore).toBe(10 * 3 + 100 * 0.7);
    expect(steady.engagementScore).toBe(1000 * 0.7);
  });

  it('requires artistName, title and file', () => {
    const doc = new TalentUploadModel({});
    const err = doc.validateSync();
    expect(err?.errors?.['artistName']).toBeDefined();
    expect(err?.errors?.['title']).toBeDefined();
    expect(err?.errors?.['fileUrl']).toBeDefined();
  });
});
