# Postroom product roadmap

## Product direction

Help one person turn an idea into a confident post for Instagram, X, or Substack Notes, with as little setup and distraction as possible. Keep drafts local-first and make cloud backup optional. Do not add a paid writing or scheduling dependency, hidden usage charges, feeds, or engagement analytics.

## Roadmap order

Sequence is based on user value, reach, cost, and fit with Postroom's low-distraction approach. These are release waves, not calendar commitments.

| Order | Development | User outcome | Release wave | Success signal |
| --- | --- | --- | --- | --- |
| 1 | Posting readiness and publish guardrails | Know what is ready, what needs attention, and what happens when publishing is clicked | Built · validation pending | Users can identify direct publish versus handoff and resolve a seeded issue without help |
| 2 | In-editor content toolkit | Improve clarity and polish with practical writing tools while staying in the compose flow | Built · validation pending | Users apply useful suggestions and report fewer edits after leaving Postroom |
| 3 | Draft search and reuse | Find an old idea quickly, then reopen or duplicate it without losing the original | Next | More saved drafts reopened or duplicated; shorter time to find a draft |
| 4 | Media preflight and accessibility | Catch image issues before leaving Postroom and add useful image descriptions | Later | Fewer media-related handoff failures; image descriptions are present where supported |
| 5 | Planner reminders | Get a timely nudge for a planned post without buying a scheduling service | Later | Planned posts are completed more often; reminder opt-in remains voluntary |

## Release waves

### Now: confidence at publish time

The first implementation is in the app: per-platform readiness, explicit handoff/direct-publish labels, and a final publish review. Usability validation remains. See [prd-publishing-readiness.md](prd-publishing-readiness.md). Do not promise background scheduling in this wave.

### Next: make writing better inside the editor

The first implementation adds local writing stats and Instagram caption cues, image metadata, and adjustable feed-frame previews. Usability validation remains. See [the editor toolkit PRD](prd-editor-toolkit.md). Follow with draft search, platform filters, and duplicate. The current toolkit works without signing in or connecting Supabase.

### Later: improve the content workflow

Improve media checks and accessibility, then add optional local reminders for planned posts. Keep each feature useful in local-only mode and avoid introducing an AI service dependency.

## Product guardrails

- Local drafting remains the default. Supabase remains optional.
- No Typefully subscription, paid AI API, or third-party publishing subscription is required.
- Do not imply X publishing is cost-free: any project-owner API usage charge must be shown before direct publish.
- Substack Notes stays on the handoff path unless a supported publishing route is verified.
- Keep the interface focused on creating and publishing. Do not add feeds, likes, analytics, or growth dashboards.
- Any scheduled reminder must say whether it depends on the browser or app being open. Do not present a reminder as automatic publishing.
- Any third-party proofreading action is explicit and opt-in; disclose when draft text leaves the device and provide useful local tools without it.
