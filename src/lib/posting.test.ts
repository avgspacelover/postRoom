import { describe, expect, it } from 'vitest';
import { getPlatformReadiness } from './posting';
import type { Platform, PostDraft } from '../types';

function makeDraft(overrides: Partial<PostDraft> = {}): PostDraft {
  return {
    id: 'draft-1',
    title: '',
    text: { instagram: '', x: '', substack: '' },
    platforms: ['instagram', 'x', 'substack'],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getPlatformReadiness', () => {
  it('requires copy for an empty X post', () => {
    expect(getPlatformReadiness('x', makeDraft()).status).toBe('Needs a fix');
  });

  it('allows an Instagram image with no caption and offers a handoff when disconnected', () => {
    const result = getPlatformReadiness('instagram', makeDraft({
      media: { name: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,AA==' },
    }));

    expect(result).toMatchObject({ status: 'Ready', connected: false, directAvailable: false });
    expect(result.detail).toContain('handoff');
  });

  it('asks the user to review Instagram posts that have no image', () => {
    const draft = makeDraft({ text: { instagram: 'Caption', x: '', substack: '' } });
    expect(getPlatformReadiness('instagram', draft).status).toBe('Review');
  });

  it('marks an eligible connected Instagram image post ready for direct review', () => {
    const draft = makeDraft({
      text: { instagram: 'Caption', x: '', substack: '' },
      media: { name: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,AA==' },
    });
    expect(getPlatformReadiness('instagram', draft, ['instagram'])).toMatchObject({
      status: 'Ready', connected: true, directAvailable: true,
    });
  });

  it('marks X posts over 280 characters as needing a fix', () => {
    const draft = makeDraft({ text: { instagram: '', x: 'x'.repeat(281), substack: '' } });
    expect(getPlatformReadiness('x', draft).detail).toContain('X limit');
  });

  it('falls back to handoff for connected X when the draft has media', () => {
    const draft = makeDraft({
      text: { instagram: '', x: 'Text with an image', substack: '' },
      media: { name: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,AA==' },
    });
    expect(getPlatformReadiness('x', draft, ['x'])).toMatchObject({
      status: 'Review', connected: true, directAvailable: false,
    });
  });

  it('returns a ready handoff state for Substack Notes', () => {
    const draft = makeDraft({ text: { instagram: '', x: '', substack: 'A short note' } });
    const result = getPlatformReadiness('substack', draft, ['instagram'] as Platform[]);
    expect(result).toMatchObject({ status: 'Ready', connected: false, directAvailable: false });
  });
});
