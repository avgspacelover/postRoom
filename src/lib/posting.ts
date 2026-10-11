import type { Platform, PostDraft } from '../types';

export type ReadinessStatus = 'Ready' | 'Review' | 'Needs a fix';

export type PlatformReadiness = {
  status: ReadinessStatus;
  detail: string;
  connected: boolean;
  directAvailable: boolean;
};

export function getPlatformReadiness(
  platform: Platform,
  draft: PostDraft,
  connectedPlatforms: readonly Platform[] = [],
): PlatformReadiness {
  const text = draft.text[platform].trim();
  const connected = connectedPlatforms.includes(platform);
  const directAvailable = connected
    && ((platform === 'instagram' && Boolean(draft.media)) || (platform === 'x' && !draft.media));

  if (!text && !(platform === 'instagram' && draft.media)) {
    return { status: 'Needs a fix', detail: 'Add some copy before continuing.', connected, directAvailable };
  }

  if (platform === 'x' && text.length > 280) {
    return { status: 'Needs a fix', detail: 'This copy is over the current X limit.', connected, directAvailable };
  }

  if (platform === 'instagram' && !draft.media) {
    return { status: 'Review', detail: 'Instagram posts usually need an image. Add one or review the handoff.', connected, directAvailable };
  }

  if (platform === 'x' && connected && draft.media) {
    return { status: 'Review', detail: 'This image needs the X handoff; direct publishing supports text only.', connected, directAvailable };
  }

  return {
    status: 'Ready',
    detail: directAvailable ? 'Direct publishing is available after review.' : 'Ready to open the platform handoff.',
    connected,
    directAvailable,
  };
}
