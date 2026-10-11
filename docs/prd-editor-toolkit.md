# PRD: In-editor content toolkit

**Status:** Local toolkit baseline built; usability validation pending  
**Priority:** 2 of the next five developments  
**Platforms:** Instagram, X, Substack Notes  
**Product constraint:** Useful in local-only mode; no paid writing service required

## Summary

Add a compact set of writing tools to the compose experience so users can improve a draft without leaving Postroom. Start with local checks and platform-aware editing aids. Evaluate an optional LanguageTool proofread action as a third-party add-on, subject to its current API rules, practical free limits, and a clear text-sharing choice.

## Problem

Postroom lets users maintain separate copy for Instagram, X, and Substack Notes, but the editor mostly offers text entry, copy, and preview. Users must leave the app to check grammar or remember basic writing structure. That context switch undermines the app's focused writing job.

## Goals

- Help users make copy clearer, shorter, and more suitable for its destination.
- Keep the tools beside the platform-specific editor and preview.
- Make useful checks available without accounts, network access, or paid services.
- Make third-party processing explicit, optional, and limited to the text the user selects.
- Leave the user in control of every suggested edit.

## Non-goals

- Generate or rewrite posts with paid AI.
- Claim a score predicts reach, engagement, or platform success.
- Automatically change the user's copy.
- Send drafts to a third party as the user types or autosaves.
- Add an embedded social feed, analytics, image marketplace, or full graphics editor.

## User stories

1. As a creator, I can spot overly long or hard-to-read copy while editing a platform version.
2. As a creator, I can use short prompts for a stronger opening, clearer point, or useful call to action.
3. As a creator, I can optionally check spelling and grammar while knowing exactly what text leaves my device.
4. As a creator, I can inspect each suggestion and apply it individually, or leave my draft unchanged.
5. As a creator, I can keep using all local tools when offline or when the third-party checker is unavailable.

## Instagram-first experience

Instagram is the first target for the editor improvements because a good post depends on both its caption and its media. Keep the experience focused on the existing feed-photo workflow first.

### Caption editor

- Preserve paragraph breaks in the editor and preview; make it easy to add spacing without typing decorative filler characters.
- Add a compact “caption shape” guide: opening line, main thought, optional call to action, optional hashtag block. Treat each part as optional guidance, not a required formula.
- Show the opening lines prominently in the preview and let the user inspect the full caption as it will be handed off.
- Show live length and line counts using maintained platform requirements. Avoid stale fixed limits and avoid “viral score” language.
- Allow quick insertion of user-owned snippets, such as a recurring signature or CTA; never auto-append them.

### Media and preview

- Improve the single-image flow with a clear thumbnail, supported-format and size feedback before publishing, and a crop/fit preview that makes likely feed framing visible.
- Keep the original image available and make any crop reversible.
- Add optional alt-text entry and persist it with the draft; expose it only where the selected publishing route supports it.
- Treat multi-image carousel and Reel support as a later expansion. First verify current Meta API support, delivery requirements, and the product's media hosting flow; retain manual handoff when a format cannot be published directly.

### Posting flow

1. Compose the Instagram caption and attach the media.
2. Run the readiness checklist for caption, media, and connected-account eligibility.
3. Show the exact route: direct publish to a connected eligible account, or copy caption/open Instagram for manual completion.
4. For direct publishing, show a final review step with the selected account, media preview, caption, and Publish/Cancel actions.
5. Confirm success or failure while preserving the draft.

Meta's current API materials describe the Instagram publishing API as intended for Professional accounts and require Meta app authorization. Verify eligibility and permissions for the chosen API route before expanding supported post types; see [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00).

## Requirements

### Must have: local writing aids

- Keep the existing platform tabs, text, character count, and preview as the core editor.
- Add small, understandable checks for selected platform text: length, empty version, paragraph/sentence density, and optional checklist prompts for opening, main point, and call to action.
- Label each check as a suggestion or a platform requirement; do not present subjective writing advice as a hard rule.
- Include a quick way to move to the relevant platform version and retain independent versions.
- Keep all checks local to the browser and usable without Supabase.
- Include Instagram-specific caption structure guidance and an opening-lines preview without forcing a template.
- Explain media constraints before an attempted publish and preserve the original asset if a crop is added.

### Should have: optional proofread tool

- Offer a deliberate **Check spelling and grammar** action; never run during typing, autosave, or draft opening.
- Before the first use, disclose that only the active platform version will be sent to LanguageTool, link its privacy information, and let the user cancel.
- Submit only the active platform text after explicit user action. Do not include title, media, account details, other platform versions, or draft IDs.
- Show suggestions with the affected text and explanation. Let users apply a suggestion individually or dismiss it.
- Preserve undo/recovery for each accepted edit and never replace the entire draft silently.
- Handle service unavailable, quota/rate limit, and unsupported language with plain-language messages and no data loss.
- Add the clearly visible LanguageTool link required by its published API rules if integration proceeds.
- Keep the proofreader disabled or omit it if current terms, privacy handling, browser cross-origin support, or expected free limits are unsuitable.

### Instagram publish safety

- Do not immediately publish an Instagram draft from a single ambiguous editor button.
- Show the chosen account and a final caption/media review before a direct publish request.
- If the account, media type, or permissions are unsupported, offer the existing manual handoff with the caption copied and draft preserved.

## Third-party evaluation: LanguageTool

LanguageTool publishes a public HTTPS proofreading endpoint and describes it as free, with no performance or availability guarantee. Its public API rules cap requests and text volume, require POST, disallow automated requests, require a visible link back, and make the integrator responsible for explaining text handling. See [LanguageTool's public API rules](https://dev.languagetool.org/public-http-api.html). The core project is open source under LGPL 2.1 or later, but that license does not remove the public service's operational limits; see the [LanguageTool repository](https://github.com/languagetool-org/languagetool).

**Recommendation:** Treat it as a candidate for a manually invoked, opt-in checker only. Before building, confirm with current official guidance that a user-clicked request from a browser app is allowed under “Do not send automated requests,” test whether browser-origin requests are supported, and estimate shared-IP limits for a public GitHub Pages deployment. Do not put a private API key in the frontend. If any check fails, ship local editor aids and retain a link that opens the user's preferred proofreading tool without transmitting text automatically.

## Acceptance criteria

- At least three useful local writing aids work in offline/local-only use.
- Advice is contextual to the selected platform version and never changes copy on its own.
- Any third-party check requires an explicit action and consent before the first transmission.
- The proofread request contains only the active platform text; no other draft fields are sent.
- Every returned suggestion can be accepted or dismissed independently.
- A failed check leaves the user's text untouched and offers a useful next step.
- The local toolkit remains usable when the third-party service is disabled, unavailable, or rate-limited.
- No feature depends on a subscription, paid API quota, or Supabase configuration.

## Measurement

- Usability review: participants can find a writing aid and understand whether it is local or external.
- Track local counts of checks invoked and suggestions applied only if product analytics are later introduced with a separate privacy decision; do not log draft text.
- Success target for usability review: at least 4 of 5 participants improve a seeded draft using the tools without leaving the compose screen.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Third-party rules or free limits change | Keep integration optional and isolated; recheck official rules before release and retain a useful local fallback. |
| Users mistake style advice for a fact | Use suggestion wording, explain the issue, and let users dismiss every result. |
| Private drafts are sent unexpectedly | Require an explicit click and disclose the exact text and destination before the first request. |
| Shared-IP rate limits affect users | Do not invoke on keystrokes; monitor reported failures and remove the integration if free service is unreliable. |
| Writing tools crowd the interface | Place them in a compact tools panel that can be opened when needed. |

## Implementation note

The working-tree baseline includes local character, word, and line counts; a long-sentence review hint; cursor-position caption cues for Instagram; image format, file-size, and dimension feedback; and original, square, and portrait framing previews that leave the uploaded file unchanged. The external proofreader, image editing/cropping, alt-text publishing, and carousel/Reel workflows remain deferred. Validate usability before marking this PRD complete.
