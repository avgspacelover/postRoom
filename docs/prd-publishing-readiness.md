# PRD: Posting readiness and publish guardrails

**Status:** Initial implementation built; usability validation pending  
**Priority:** 1 of the next five developments  
**Owner:** Product and engineering  
**Platforms:** Instagram, X, Substack Notes

## Summary

Before a user leaves the editor or publishes directly, Postroom should clearly show whether each selected platform version is ready, what needs attention, and what the primary action will do. This reduces avoidable mistakes while preserving the user's final control over publishing.

## Problem

Postroom supports independent platform copy, attached media, handoff, and optional direct publishing. Those paths have different requirements and costs. The user currently has to infer whether a post is ready and what the main button will do. A failure message after an action is too late to resolve a missing image, overlong post, unconnected account, or unexpected paid API usage.

## Goals

- Make readiness understandable at a glance for each selected platform.
- Catch fixable issues before opening a platform or sending a publish request.
- Make direct publish, platform handoff, and their consequences distinct.
- Keep platform-specific versions editable and preserve the current local-first workflow.
- Surface any known usage charge immediately before a billable publish action.

## Non-goals

- Guarantee platform approval or delivery.
- Publish to Substack Notes directly.
- Add background scheduling, feeds, analytics, or post performance tracking.
- Add paid AI writing or external content scanning.
- Block handoff for a warning that the user can reasonably review themselves.

## Users and primary job

**Primary user:** A solo creator who drafts once, adapts copy by platform, and wants a quiet place to prepare before finishing or publishing.

**Job:** “When I am ready to post, help me catch the important issues and make clear whether Postroom will publish now or take me to the platform.”

## User stories

1. As a creator, I can see readiness for every selected platform without switching through each tab.
2. As a creator, I can fix a warning from the readiness list with one action that takes me to the relevant editor control.
3. As a creator, I can tell whether the primary action publishes directly or opens a platform handoff.
4. As a creator, I see the X project billing disclosure before an X API publish request.
5. As a creator, I can proceed through a non-blocking warning after reviewing it.

## Requirements

### Must have

- A compact readiness summary for selected platforms, with states **Ready**, **Review**, and **Needs a fix**.
- Per-platform checks for empty copy, supported text length, required media, connection availability, and direct-publish capability.
- Platform-specific guidance that does not overstate what the app can verify. Unknown or unsupported requirements appear as a review note, not a false pass.
- A clear action label for the current path: **Publish to [platform]** for connected direct publishing, or **Open [platform]** for handoff.
- A confirmation step for direct publishing that names the destination and states any known cost or content limitation.
- A way to continue to handoff when direct publishing is unavailable or the user prefers to finish on the platform.
- Error feedback that preserves the draft and gives a practical next action.
- Accessible status text and keyboard-operable links to resolve issues.

### Should have

- A single summary for multi-platform drafts, with one-click navigation to the first issue.
- Draft state remains intact after cancellation, failed publishing, or navigation to Settings.
- The readiness panel updates immediately as copy, media, connections, and selected platforms change.

### Won't have in this release

- Platform-specific preview simulation beyond the existing preview cards.
- Automated moderation, link checking, or content scoring.
- Automatic retries after an ambiguous publish response, to avoid duplicate posts.

## Interaction outline

1. The user edits a draft and selects destinations.
2. A readiness panel lists each destination and any blocking issue or review note.
3. Selecting an issue focuses the relevant version, media control, or Settings connection card.
4. The action button states the exact route. For direct publishing, the user reviews a final confirmation that names the account/platform and cost disclosure where relevant.
5. On success, Postroom confirms the platform response. On failure, it keeps the draft and offers the handoff or a corrective action.

## Acceptance criteria

- Every selected platform has a visible readiness state before the primary action is used.
- Empty copy and known blocking conditions prevent direct publish and identify how to resolve them.
- Handoff and direct publish are never presented with the same ambiguous button label.
- X direct publish shows its project-owner usage-charge disclosure at the final confirmation point.
- Missing connections explain how to connect an account or use handoff instead.
- A failed or cancelled action leaves all draft copy, media, and schedule fields unchanged.
- Keyboard and screen-reader users can identify each state and reach its resolution action.
- Readiness copy distinguishes verified checks from user review notes.

## Implementation note

The working-tree implementation includes readiness states for selected platforms, actionable navigation to the affected editor tab, direct-publish versus handoff labels, and a final review dialog with destination and cost disclosure. Usability review and accessibility verification remain before calling this complete.

## Measurement

- Track local, privacy-preserving event counts only if analytics are added later; analytics are not a dependency for launch.
- During usability review, ask users to identify each platform's action path and any required fix without coaching.
- Record publish-blocked errors by reason from user-reported feedback, not by sending draft content to a server.
- Success target for usability review: at least 4 of 5 participants correctly identify direct publish versus handoff and fix a seeded blocking issue without help.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Platform rules change | Keep validation rules isolated and review official platform requirements before updating them. Show review notes where a check cannot be guaranteed. |
| A successful request has an unclear response | Do not automatically retry; preserve the draft and tell the user to check the destination before retrying. |
| Cost disclosure becomes stale | Use direct, plain wording tied to the configured provider project; avoid fixed price claims unless verified and maintained. |
| Extra checks make the composer feel heavy | Keep the summary compact, put detail behind each platform row, and do not add a scoring or grading system. |

## Dependencies

- Current connection state from Settings and the existing Supabase functions.
- A reviewed list of checks supported by current platform behavior.
- No new paid service or backend is required.
