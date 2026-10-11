import type { PostDraft } from '../types';

const KEY = 'postroom.drafts.v1';

export function readDrafts(): PostDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value as PostDraft[] : [];
  } catch {
    return [];
  }
}

export function writeDrafts(drafts: PostDraft[]): void {
  localStorage.setItem(KEY, JSON.stringify(drafts));
}
