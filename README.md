# Postroom

Postroom is a distraction-free posting workspace for preparing content for Instagram, X, and Substack Notes. It has no feed, timeline, recommendations, comments, or analytics.

## Stack

- React + TypeScript + Vite
- Supabase JS for optional sign-in and encrypted-in-transit cloud draft backup
- Browser local storage for zero-setup, local-only use
- Netlify static hosting or GitHub Pages through GitHub Actions

The default app has no backend dependency and makes no paid API calls. Post handoffs are free: X opens a prefilled compose intent; Instagram and Substack Notes open their site and copy the selected platform text so it can be pasted. The final review and publish action happens on the platform. Automated publishing and unattended scheduling are intentionally out of scope because the supported routes either require paid API usage, platform app authorization, or are not documented for Notes publishing.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run dev
```

Create a production build with `npm run build`; preview it with `npm run preview`.

## Local data

Drafts and small attached images live in the current browser's local storage. Use Settings → Export before changing devices, browsers, or clearing site data. Import can merge a Postroom JSON backup into the current browser.

## Optional Supabase backup

The app works without Supabase. To sync drafts across devices, create a Supabase project, copy `.env.example` to `.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run `supabase/migrations/20261011000000_postroom_drafts.sql` in the Supabase SQL editor. This creates a table with row-level security so each signed-in user can read and edit only their own drafts. Add the same two `VITE_` variables to the host's build environment before deploying.

Supabase is optional and its free plan limits can change. You can use Postroom without creating a Supabase account or paying for cloud storage.

## Hosting

**Netlify:** Import the repository. `netlify.toml` configures `npm run build` and `dist` as the publish directory. If cloud backup is enabled, add the two Supabase environment variables in Netlify.

**GitHub Pages:** The included `.github/workflows/deploy.yml` builds on pushes to `main` and deploys `dist`. In the repository, set Pages → Build and deployment → Source to **GitHub Actions**. The Vite base path is relative so it works from a project page URL. Set repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only if using Supabase.

## Platform limitations

- X's official create-post API is usage-priced; this app uses the free prefilled compose handoff.
- Instagram API publishing requires a Meta app and authorization for an eligible professional account; this app uses a manual handoff.
- Substack Notes can be posted from Substack's composer, but the official API materials consulted for this project do not document a public Notes publishing endpoint. The app copies the Note text and opens Substack. No cookie-based or reverse-engineered publishing calls are used.

Platform documentation can change. Recheck the official API terms before adding direct publishing.
