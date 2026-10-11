# Postroom

Postroom is a distraction-free posting workspace for preparing content for Instagram, X, and Substack Notes. It has no feed, timeline, recommendations, comments, or analytics.

## Stack

- React + TypeScript + Vite
- Supabase JS for optional sign-in and encrypted-in-transit cloud draft backup
- Browser local storage for zero-setup, local-only use
- Netlify static hosting or GitHub Pages through GitHub Actions

The default app has no backend dependency and makes no paid API calls. Post handoffs are free: X opens a prefilled compose intent; Instagram and Substack Notes open their site and copy the selected platform text so it can be pasted. The final review and publish action happens on the platform.

Optional direct publishing connectors are included for X and Instagram. They use OAuth and Supabase Edge Functions so provider secrets and user tokens stay server-side. A user can connect an eligible account from Settings; the composer then offers direct publishing for that connected platform. X's usage charges apply to the developer project owner. Instagram requires an eligible Professional account and Meta app permissions. Substack Notes remains on the free handoff path because the official API materials do not document Notes publishing. Direct publishing does not currently schedule posts in the background.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run dev
```

Create a production build with `npm run build`; preview it with `npm run preview`.

## Local data

Drafts and small attached images live in the current browser's local storage. Use Settings → Export before changing devices, browsers, or clearing site data. Import can merge a Postroom JSON backup into the current browser.

## Supabase and optional API connections

The app works without Supabase. To use cloud draft backup or API connections, create a Supabase project, copy `.env.example` to `.env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run `supabase/migrations/20261011000000_postroom_drafts.sql` in the Supabase SQL editor. This creates a row-level-secured draft table and server-only OAuth/token tables. Add the same two `VITE_` variables to the host's build environment before deploying.

The provider connector functions are in `supabase/functions/`. Deploy them with the Supabase CLI after linking your project:

```sh
supabase functions deploy platform-oauth-start
supabase functions deploy platform-oauth-callback
supabase functions deploy platform-connections
supabase functions deploy platform-publish
```

Set Supabase Function secrets: `APP_URL` (the deployed app origin), `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_DAILY_POST_LIMIT` (a positive integer that enables X posting and caps billable create-post requests across the whole app in a rolling 24 hours), `META_APP_ID`, `META_APP_SECRET`, and `META_GRAPH_VERSION`. X publishing is disabled until the daily cap is set. Register `https://<project-ref>.supabase.co/functions/v1/platform-oauth-callback` as the exact callback URL in each provider developer app. In Supabase Auth, allow the deployed app URL as a redirect URL. The X developer project must have OAuth 2.0 enabled with `tweet.read`, `tweet.write`, `users.read`, and `offline.access`; Meta needs Instagram Login and the `instagram_business_basic` and `instagram_business_content_publish` permissions. App review/advanced access may be required before other users can connect.

Supabase is optional and its free plan limits can change. You can use Postroom without creating a Supabase account or paying for cloud storage. X usage charges are billed to the X developer project that owns the OAuth app, not automatically to each connected user. For a public app, plan how you will handle that billing before enabling X publishing broadly.

## Hosting

**Netlify:** Import the repository. `netlify.toml` configures `npm run build` and `dist` as the publish directory. If cloud backup is enabled, add the two Supabase environment variables in Netlify.

**GitHub Pages:** The included `.github/workflows/deploy.yml` builds on pushes to `main` and deploys `dist`. In the repository, set Pages → Build and deployment → Source to **GitHub Actions**. The Vite base path is relative so it works from a project page URL. Set repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only if using Supabase.

## Platform limitations

- X's direct publishing uses the official usage-priced create-post API. The app also keeps the free prefilled compose handoff available.
- Instagram direct publishing requires a Meta app and authorization for an eligible professional account. The app keeps the manual handoff available.
- Substack Notes can be posted from Substack's composer, but the official API materials consulted for this project do not document a public Notes publishing endpoint. The app copies the Note text and opens Substack. No cookie-based or reverse-engineered publishing calls are used.

Platform documentation can change. Recheck the official API requirements before enabling these connectors for production users.
