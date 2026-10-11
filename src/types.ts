export type Platform = 'instagram' | 'x' | 'substack';
export type Page = 'compose' | 'drafts' | 'calendar' | 'settings';

export type PostDraft = {
  id: string;
  title: string;
  text: Record<Platform, string>;
  platforms: Platform[];
  media?: { name: string; dataUrl: string; sizeBytes?: number; width?: number; height?: number; altText?: string };
  scheduledAt?: string;
  updatedAt: string;
};

export const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  x: 'X',
  substack: 'Substack Notes',
};

export const freshDraft = (): PostDraft => ({
  id: crypto.randomUUID(),
  title: '',
  text: { instagram: '', x: '', substack: '' },
  platforms: ['instagram', 'x', 'substack'],
  updatedAt: new Date().toISOString(),
});
