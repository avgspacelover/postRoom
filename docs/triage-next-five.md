# Triage: next five feature developments

Triage balances user delight and task frequency against implementation effort, reliability risk, and ongoing cost. Scores are directional product judgments, not user research. A higher score means earlier work.

| Rank | Feature | Delight / reach (1–5) | Effort (1–5) | Risk / upkeep (1–5) | Triage | Decision |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | Posting readiness and publish guardrails | 5 | 3 | 3 | **P1 · Built** | Prevents avoidable mistakes at the highest-consequence moment; usability validation remains. |
| 2 | In-editor content toolkit | 5 | 3 | 3 | **P2 · Built** | Adds local editing aids; usability validation remains and third-party proofing is deferred. |
| 3 | Draft search and reuse | 4 | 2 | 1 | **P2 · Built** | Frequent, low-cost improvement to the core draft library. |
| 4 | Media preflight and accessibility | 4 | 3 | 3 | **P3 · Next** | Reduces media friction and improves accessible posting without adding a service. |
| 5 | Planner reminders | 4 | 3 | 3 | **P3 · Later** | Closes the gap between planning and posting; define browser-closed behavior honestly. |

## Triage notes

### 1. Posting readiness and publish guardrails — P1 · built, validation pending

- **User pain:** Unclear requirements and action path can lead to failed or unintended publishing.
- **Smallest valuable release:** Per-platform Ready / Review / Needs a fix checklist, actionable issues, distinct handoff/direct labels, and a final cost disclosure where applicable.
- **Dependencies:** Current account state and verified platform checks.
- **Do not expand into:** Analytics, moderation, or automatic retry.
- **Exit condition:** Usability review confirms users understand the action and can resolve seeded issues.

### 2. In-editor content toolkit — P2 · built, validation pending

- **User pain:** The editor prepares versions for each platform, but offers few ways to strengthen copy before leaving the app.
- **Smallest valuable release:** Local character, word, and line stats; long-sentence review hint; cursor-position caption cues; Instagram image metadata and frame previews. This baseline is built; usability validation remains.
- **Third-party candidate:** LanguageTool's public proofreading API is free, but its official [public API rules](https://dev.languagetool.org/public-http-api.html) cap requests and text volume, offer no availability guarantee, require a visible LanguageTool link, and put text-handling disclosure on the integrator. It also says not to send automated requests. Treat it as an evaluation candidate, not a guaranteed integration: verify that an explicit user-clicked check complies with current rules, and do not send text automatically while the user types. If free use cannot meet expected traffic or policy, ship the local tools only.
- **Privacy requirement:** No third-party proofreader is currently called. If LanguageTool is later adopted, explain text transmission before the first check, send only active platform text after explicit action, and preserve an offline/local-only alternative.
- **Dependencies:** Copy model supports per-platform text; accessible way to review and apply suggestions without replacing the whole draft.
- **Do not expand into:** Paid AI rewriting, automatic tone rewriting, hidden third-party calls, or claims that suggestions are always correct.
- **Exit condition:** Users can complete the writing flow without an account or network; usability review confirms that stats, cues, media feedback, and previews improve the draft without crowding the editor.

### 3. Draft search and reuse — P2 · built

- **User pain:** As saved drafts grow, finding and reusing an idea becomes slower.
- **Smallest valuable release:** Search title and platform copy; filter by selected platform; duplicate a draft while keeping the original untouched. The Drafts library now includes all three actions.
- **Dependencies:** None; works with local storage and Supabase-backed drafts.
- **Do not expand into:** Folders, collaboration, or cloud-only indexing in the first version.
- **Exit condition:** A user can find and duplicate a chosen draft from the Drafts view without editing the original.

### 4. Media preflight and accessibility — P3

- **User pain:** A draft can reach handoff with media that is too large, unsupported, or missing descriptive text.
- **Smallest valuable release:** Show image dimensions and file size, explain current limits before upload, and let users add alt text to the draft for destinations that accept it.
- **Dependencies:** Confirm the destination-specific behavior and persist the description with the draft.
- **Do not expand into:** Full image editor, cloud media library, or claims that one image format/size works everywhere.
- **Exit condition:** The user can spot a known media issue and fix it before publishing; image description remains with the draft.

### 5. Planner reminders — P3

- **User pain:** A planned date in the app does not itself remind the user or publish the post.
- **Smallest valuable release:** Optional browser notification permission, a clear due-soon list, and an “Open draft” action; notification fallback when unsupported.
- **Dependencies:** Browser notification support and user consent; define behavior when the browser is closed before implementation.
- **Do not expand into:** Paid cron services or unattended publishing.
- **Exit condition:** Reminder is opt-in, testable, dismissible, and clearly described as a nudge rather than scheduled publishing.

## Hold / reject for this roadmap

- **Background auto-publishing for planned posts:** Out of scope until provider support, ongoing cost, token lifecycle, duplicate protection, and user expectations can be handled reliably.
- **Paid AI writing or a Typefully-like service:** Conflicts with the product's low-cost positioning and creates a recurring dependency.
- **Feeds, analytics, and engagement dashboards:** Pull attention away from Postroom's focused drafting job.
- **Direct Substack Notes API integration:** Do not prioritize without a supported route that can be verified.
