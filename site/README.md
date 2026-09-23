# tekjobs.timurtek.com

The landing page and docs for TekJobs, on Next.js (App Router) and Zengin UI, deployed to Vercel from this folder. Created with `zengin create --template marketing --framework next`, then rebuilt for TekJobs: the brand file is the app's, the mark is the author's avatar, the docs are markdown under `content/docs`.

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # zengin check: every file in src against zengin/
npx tsc --noEmit
```

## Where things are

| Path | What |
| --- | --- |
| `src/app/` | Routes: `/` (landing), `/docs/[slug]`, `/login`, `/account`, `/post-a-job`, and the API routes under `api/`. |
| `src/sections/` | The landing's sections. `src/content.ts` holds every word and number on it. |
| `content/docs/*.md` | One doc page each, with `title`, `order` and `summary` frontmatter. `src/lib/docs.ts` reads them at build time. |
| `src/theme/brand.css` | The TekJobs brand, copied from `app/src/theme/brand.css`. Keep the two in step. |
| `src/components/ui/` | Zengin UI components, owned here. `npm run add -- <name>` brings more from the registry. |
| `src/lib/firebaseClient.ts`, `src/components/auth/` | Firebase auth on the client; the provider posts each ID token to `/api/auth/session`, which mints a session cookie with the Admin SDK. |
| `src/server/` | Admin SDK init, identity from bearer token or cookie, Stripe Checkout over REST, webhook signature verification, entitlements in Firestore. |
| `.env.example` | Every variable. Without the Firebase keys there is no sign-in; without the Stripe keys and `NEXT_PUBLIC_PURCHASES_OPEN=1` nothing is for sale; the landing and docs work either way. |

## Auth and payments

Same shape as the AstroSense web app, so the two share one pattern: Firebase for identity (Google and email/password), a two-week session cookie minted server-side, Stripe Checkout Sessions created with the secret key over the REST API (no SDK), a webhook verified with HMAC-SHA256 that writes `entitlements/{id}` documents in Firestore, idempotent on the session id and granted only when `payment_status` is `paid`. The one product is a job posting; its Price id is `STRIPE_PRICE_JOB_POSTING`. Refunds revoke.

## Deploying

One Vercel project with **Root Directory** set to `site`. Framework preset Next.js, no build command override. To skip builds when nothing under `site/` changed, set the Ignored Build Step to:

```
git diff --quiet HEAD^ HEAD -- .
```

Environment variables from `.env.example`. DNS: a `tekjobs` CNAME on `timurtek.com` pointing at Vercel. Stripe's webhook endpoint is `https://tekjobs.timurtek.com/api/stripe-webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`.
