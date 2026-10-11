import { beforeEach, describe, expect, it } from 'vitest';
import { readDrafts, writeDrafts } from './storage';
import type { PostDraft } from '../types';

const KEY = 'postroom.drafts.v1';
const draft: PostDraft = {
  id: 'draft-1',
  title: 'A post',
  text: { instagram: 'Caption', x: 'Post', substack: 'Note' },
  platforms: ['instagram'],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('draft storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty list when no drafts are saved', () => {
    expect(readDrafts()).toEqual([]);
  });

  it('round-trips draft records through local storage', () => {
    writeDrafts([draft]);
    expect(readDrafts()).toEqual([draft]);
  });

  it('recovers from malformed stored JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readDrafts()).toEqual([]);
  });

  it('rejects a valid JSON value that is not a draft array', () => {
    localStorage.setItem(KEY, JSON.stringify({ drafts: [draft] }));
    expect(readDrafts()).toEqual([]);
  });
});
