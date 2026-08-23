# Immoreel — QA Baseline (Phase 0)

Date: 2026-08-21
Commit: `9b7d88c` ("Add video editor improvements2") + **45 modified / 2 untracked files in the working tree** (uncommitted).
Scope: read-only inspection. **No code was modified.**

> Working-tree warning: the baseline below was measured against the *working tree*, not against `9b7d88c`.
> 45 files are modified and uncommitted, including `src/app/api/billing/webhook/route.ts`,
> `src/db/project-store.ts`, `src/lib/billing/actions.ts` and `src/lib/mollie/config.ts`.
> Any claim about the state of the last commit is unverified.

---

## 1. Baseline command results

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | already installed, tree present | Node v24.14.1, npm 11.11.0 |
| `npm run lint` | **PASS** — 0 errors, 0 warnings | `eslint .` with `eslint-config-next` |
| `npm run typecheck` | **PASS** — 0 errors | `tsc --noEmit`, strict |
| `npm run build` | **PASS** | 52 routes; 4 static (`/`, `/_not-found`, `/forgot-password`, `/signup`), the rest dynamic; middleware (`proxy`) compiled |
| `npm run seed -- --check` | **PASS** — "alle verwijzingen, factuurnummers en wachtwoorden kloppen" | Referential integrity of demo data verified |
| `npm test` | **PASS** — 9 tests, 0 failures | Added while fixing B0; `node --test` via tsx, no new dependencies. Was: did not exist. |

Static quality gates are green. That is a statement about *syntax and types*, not about correctness,
security or behaviour — there is nothing in this repo that executes the application and asserts on
the result.

### Local infrastructure available for testing

| Dependency | Present | Consequence |
| --- | --- | --- |
| Redis | **No** (`redis-cli` not found) | `isQueueConfigured()` is false, so every export returns 503; render queue untestable |
| Docker | **No** | Cannot start Redis the way `src/workers/README.md` prescribes |
| FFmpeg | **No** | Real render backend untestable; only the fake backend can run |
| `.env.local` | **Absent** | App runs on dev defaults: dev auth secret, seed on, no Mollie, no Redis, no storage |
| Mollie sandbox key | Not configured | Billing flows untestable end-to-end |
| Email provider | **Does not exist in the code** | See §4, B2 |

---

## 2. Architecture as actually implemented

```
browser
  |
  |- src/proxy.ts ................ Next 16 middleware. Verifies the HMAC session cookie
  |                               signature + expiry only. Never touches a store.
  |
  |- (auth) routes ............... login / signup / forgot / reset / magic-link /
  |                               invite / email-change. Server actions.
  |- (app) routes ................ dashboard, projects, editor, exports, billing,
  |                               settings (account / team / brand-kit), media
  |- /admin ...................... internal read-only support panel
  |
  '- /api/* (19 route files) ..... thin handlers over shared services
        |
        |- lib/api/ .............. handle() error edge, requireApiSession(),
        |                          InputReader (shape validation), ApiError envelope
        |- lib/<domain>/ ......... projects, editor, billing, team, account, brand,
        |                          exports, uploads, notifications, errors
        |
        '- src/db/*-store.ts ..... 13 stores, ALL in-memory Maps on globalThis
                                   (auth, account, admin, billing, brand-kit,
                                    dashboard, notification, project,
                                    project-asset, render-job, team, template)

worker (separate process, `npm run worker`)
  '- BullMQ over Redis -> render/pipeline.ts -> render/backend.ts -> render/ffmpeg/*
                                             -> render/storage.ts (file:// on disk)
```

### The four load-bearing facts

1. **There is no database.** `src/db/client.ts` is a stub that returns `{ connectionString }` and
   carries `// TODO: vervang door de echte client zodra de ORM gekozen is.` A
   `prisma/schema.prisma` file exists, but Prisma is **not a dependency** in `package.json` and is
   not imported anywhere. Every store keeps a `Map` on `globalThis`.
2. **The ports are clean.** Every store is a `type` with an implementation behind a `getXStore()`.
   Every read and write takes `organisationId` as its first argument. Swapping in a real database
   is genuinely one implementation per store. This is the strongest thing about the codebase.
3. **Multi-tenancy is enforced at the store, not at the route.** `findProject(organisationId, id)`
   returns `null` for a foreign id — the lookup *is* the authorization check — and that pattern is
   applied consistently to assets, render jobs, checkouts and notifications.
4. **The worker cannot see the web server's data.** Because stores are per-process Maps, a real
   `npm run worker` process fails every job with `project-missing`. The documented workaround is
   `RENDER_WORKER_INLINE=1`, which runs the worker inside the web server. `src/workers/README.md`
   states it plainly: *"Dat is een tijdelijke steun, geen ontwerp."*

### Auth model

- Session = **stateless HMAC-SHA256 token** (`base64url(payload).base64url(sig)`), payload
  `{sid, uid, iat, exp}`, TTL 30 days, cookie `immoreel_session`, `httpOnly`, `sameSite=lax`,
  `secure` in production. `AUTH_SECRET` is mandatory in production (throws if absent or < 32 chars).
- Role and organisation are **deliberately not in the token**; they are re-read from the store on
  every request via `getSession()` (React `cache`d). A demoted or removed user loses access at once.
- Passwords: **scrypt** (N=16384, r=8, p=1, 64-byte key, 16-byte salt), parameters embedded in the
  hash, `timingSafeEqual` comparison, plus `burnPasswordTime()` to equalise the "unknown email"
  path. Max password length 200 as a scrypt DoS guard. This is done correctly.
- Email tokens: 32 random bytes, **SHA-256 hashed at rest**, single-use, revoked on use.
- RBAC: `owner > editor > viewer` over an 8-entry `Permission` map. Team mutations run pure rule
  functions (`lib/team/rules.ts`) server-side *and* client-side — same function, so no drift.
- `/admin` is gated by an `ADMIN_EMAILS` env list (never a database role — deliberate), returns
  **404 rather than 403** for non-staff, and is read-only by construction.

### Billing model

Mollie. The first payment is `sequenceType: "first"` (collects money *and* the mandate); the
recurring subscription is created only after that payment succeeds. The webhook is unauthenticated
**by design, and correctly so**: Mollie sends only `id=tr_...`, and the handler uses that id purely
to `GET` the payment with our own API key — the fetched object is the source of truth. Idempotency
is real: invoice upsert keyed on payment id, terminal-state writes rather than increments,
`idempotencyKey` on upgrade payments and subscription creation, and `ensureMollieSubscription()`
returns early when one already exists.

---

## 3. Known limitations the code itself declares

Quoted from the source, not inferred:

| Location | Statement |
| --- | --- |
| `src/db/client.ts:26` | `TODO: vervang door de echte client zodra de ORM gekozen is.` |
| 11 x `src/db/*-store.ts` | `TODO: databank-implementatie zodra de ORM gekozen is` |
| `src/db/README.md` | *"het is leeg na elke herstart en wordt niet gedeeld tussen instanties"* |
| `src/lib/auth/email.ts:22` | `TODO: koppel de e-mailprovider` — **throws in production** |
| `src/lib/uploads/storage.ts` | `TODO: S3-compatibele implementatie` — throws 503 if `STORAGE_BUCKET` is set |
| `src/lib/account/actions.ts:351` | projects, renders, brand kit and invoices of a deleted organisation are **left behind** |
| `src/db/template-store.ts:79` | organisation-owned templates not implemented |
| `src/lib/editor/audio.ts:78` | music catalogue is hard-coded; no media library |
| `src/workers/README.md` ("Wat er nog niet is") | object storage for photos, voice-over ducking, price badge, real logo file, media jobs |
| `src/app/(editor)/editor/[projectId]/page.tsx:43` | user-facing: *"Projecten worden voorlopig in het geheugen bewaard, dus na een herstart van de server zijn ze weg."* |
| `src/app/(app)/settings/page.tsx:83` | organisation details cannot be edited — "mail support" |
| `src/components/account/delete-account-card.tsx:96` | *"Dit kan nu nog niet."* |

The README's opening paragraph is accurate about the two big gaps (no database, no object storage).
It is **silent** about the missing email provider, which is the more immediate launch blocker.

---

## 4. Obvious production blockers (from reading alone)

Ordered by how quickly each turns into a support ticket on day one.

**B0 — Infinite redirect loop locks every logged-in user out. PROVEN — FIXED 2026-08-21.**

Reported by the user as "I try to create an account, it says rendering, and then nothing happens".
Reproduced: create an account, restart the dev server, open `/` → `ERR_TOO_MANY_REDIRECTS`, blank
screen. Server log showed `GET /dashboard 307` dozens of times in a row.

Root cause — two layers disagree about who is logged in:

| Layer | Checks | Verdict after a restart |
| --- | --- | --- |
| `src/proxy.ts` | HMAC signature + expiry of the cookie only | "logged in" |
| `(app)/layout.tsx` → `requireSession()` | whether the user exists in the store | "not logged in" |

The cookie is stateless and valid for 30 days (B6); the user row lives in a `globalThis` Map and is
gone after a restart (B1). So `/dashboard` redirects to `/login`, the proxy sees a valid cookie and
`/login` is in `GUEST_ONLY_ROUTES`, so it redirects back to `/dashboard`, forever. `/signup` and
`/forgot-password` are guest-only too, so there is no escape route: the user can only get out by
manually clearing cookies.

This is not a dev-only annoyance. **Every production deploy triggers it for every logged-in
customer**, for exactly the same reason. B1 and B6 were each noted separately in this baseline; that
together they form a total lockout was missed.

Fix (this is the combination of B1 and B6, not a replacement for fixing either):

- `src/app/(auth)/session-expired/route.ts` — new route handler that clears the orphaned cookie and
  sends the user to `/login?melding=sessie-verlopen`. A route handler can clear cookies; a server
  component cannot, hence the extra hop. It clears **only** a session that fails the store check, so
  `<img src="/session-expired">` on a hostile site cannot log anyone out.
- `requireSession()` now redirects there instead of to `/login` when a cookie is present.
- `/` added to `PUBLIC_ROUTES` — the front door was behind the guard, producing the useless
  `/login?redirectTo=%2F`.

Verified: chain is now `/` → `/dashboard` → `/session-expired` → `/login` (3 hops, terminating),
signup works, typecheck/lint/build green, 9/9 tests pass. The regression test was confirmed to fail
with the fix reverted (`redirectlus: /login -> /dashboard -> /login -> ...`).

**B6b — The editor showed no photos after the wizard. PROVEN — FIXED 2026-08-21.**

Reported by the user: create a project, add photos, open the editor — no photos, no video preview.

Reproduced by replaying the wizard's exact sequence through the API. The server side was **entirely
correct**: `POST /api/projects` created the project with `scenes: []`, and `POST .../assets` (without
`?scenes=none`) produced 3 assets and 3 scenes with the right assetIds. The editor rendered the
timeline correctly — Intro, Scène 1–3, Contact — and showed nothing inside it. The browser made no
request for the photos at all.

Cause: `toEditorDocument()` built each scene's source with only `assetId` and `fileName`, and
`createSceneSource()` defaults `previewUrl` to `null`. That field is what the photo list, the
preview stage *and* the playback plan all read to display an image. So every scene loaded from
storage was blank by construction. The comment above the function still claimed photos "are not in
object storage yet, so a scene from the database has no preview" — that stopped being true once
`/api/assets/:assetId` existed.

It worked while dragging photos into the editor because that path creates a blob URL in the browser.
A blob URL belongs to one tab and does not survive navigation — which is why it broke on exactly the
step where the user needs it: arriving from the wizard, or reloading the page.

Fix: one line — `previewUrl: scene.assetId ? API_ROUTES.asset(scene.assetId) : null`. Not a blob URL
(tab-scoped) and not a storage URL (would bypass the permission check): the app's own route, which
still verifies the photo belongs to this office. Scenes without a photo keep `null` and stay a grey
frame, which is the correct neutral state for the seeded demo projects.

Verified in the browser: photo list shows all three thumbnails, and the preview plays the images with
their zoom motion. `tests/editor-document.test.ts` (5 tests) pins it; confirmed to fail 4/5 with the
line removed.

Worth noting for the audit: build, lint, typecheck and 45 tests were all green while this bug made
the product's core workflow useless. Nothing in the automated suite reached the wizard → editor path.

**B13 — Per-scene transitions were ignored by the timeline and the preview. PROVEN — FIXED 2026-08-21.**

Reported as "I change the transition and nothing happens". Correct, and worse than that: the render
*did* honour it, so the preview was showing the agent a different video from the one they would get.

`buildTimeline()` and `buildPreviewPlan()` both used `projectTransition(document) ?? style.transition`
— a helper that returns the shared transition **only when every scene has the same one**, and `null`
otherwise. So the moment two scenes differed, both fell back to the template's transition and every
per-scene choice was discarded. `buildRenderPlan()` always resolved per scene.

Proven side by side:

```
chosen   : hard, schuif, dip-to-black
PREVIEW  : crossfade, crossfade, crossfade   ← all three choices dropped
RENDER   : hard, schuif, dip-to-black        ← correct
duration : preview 14.5s | render 15.5s
```

Note the signature was never the problem — `scene.transition` is in `previewSignature()`, so the
preview *did* rebuild on every change. It just rebuilt the identical plan each time, which is exactly
why it looked like nothing happened.

Fix: `overlapFor()` in `document.ts` resolves the overlap per block from that block's own scene
(intro and contact card follow the template, since they have no scene), and `buildPreviewPlan()`
reads `scene.transition` per slide. Both now use the same rule as `buildRenderPlan()`.
`projectTransition()` is kept but documented as unsuitable for building plans.

Verified in the browser on a seeded project: changing one scene from "hard" to "dip-to-black" moves
the timeline from 0:15 to 0:14. `tests/editor-transitions.test.ts` (9 tests) pins preview against
render for four transition combinations; 7 of the 9 were confirmed to fail with the fix reverted.

**Left alone deliberately:** preview and render still disagree on total duration by a constant 0.5 s,
because `buildRenderPlan()` adds the intro and contact card at full length while `buildTimeline()`
overlaps them too. Which one matches the FFmpeg output cannot be determined without a real render,
and changing the render plan would shift every render fingerprint (and therefore every existing job
id). **NOT PROVEN — needs one real render to settle.**

**B14 — Brand kit edits were lost on navigation, with no warning. PROVEN — FIXED 2026-08-21.**

Reproduced: change the primary colour, click a menu item, come back — the change is gone. The form
even said "Je hebt wijzigingen die nog niet bewaard zijn" while letting the click through.

Two gaps, not one:

1. **The brand kit form had no guard at all.** It computes `isDirty` and uses it to enable the save
   button, but nothing acted on it when leaving.
2. **`beforeunload` would not have been enough anyway.** The editor *does* register one
   (`use-autosave.ts`), but that event only fires for closing or reloading a tab. Clicking a menu
   item is a client-side navigation — the browser never sees it, so `beforeunload` never runs. The
   editor is therefore protected against closing the tab but **not** against in-app navigation
   either.

Fix: `src/components/ui/unsaved-changes-guard.tsx`, a reusable component that covers both routes out.
It registers `beforeunload` for tab close, and intercepts link clicks in the capture phase — before
the router sees them — so it can ask first and navigate afterwards via `router.push()`. It ignores
modifier-clicks (those open a new tab), external links, `target="_blank"`, downloads, and navigation
to the current page. Uses the app's own `Modal` rather than `confirm()`, so the question reads as
coming from the screen rather than from the browser.

Verified in the browser across five cases: dirty + navigate shows the dialog; "Hier blijven" keeps
both the page and the edit; "Weggaan zonder opslaan" navigates; clean form navigates with no dialog;
and after saving, navigation is free again (the guard does not get stuck on).

**NOT PROVEN by automated test.** This is React interaction behaviour and there is no DOM test
environment in the project — no jsdom, no testing-library. The five cases above were checked by hand
in the browser. Adding a component-test setup is a separate decision.

**Same class of bug, not fixed:** `src/components/account/profile-form.tsx` holds its value in local
state behind a save button, so editing a name and navigating away loses it in exactly the same way.
One field rather than a whole brand kit, and left alone pending a decision.

**B1 — All data is lost on every restart, deploy and scale event.**
Thirteen in-memory stores. A deploy wipes every customer's projects, asset metadata, renders,
invoices, subscriptions, team and password hashes. Two instances behind a load balancer see two
different worlds: a user logs in on instance A and is a stranger on instance B. Not a risk — a
certainty.

**B2 — No email provider: `deliver()` throws in production.**
`src/lib/auth/email.ts` explicitly throws when `NODE_ENV === "production"`. So in production
**password reset, magic link, team invitations, email-change confirmation and the security-notice
mails all fail with an unhandled server error.** There is no account recovery and no way to add a
colleague. `src/lib/notifications/email.ts` has the same shape.

**B3 — Rendering is not gated on payment. PROVEN — PART (a) FIXED 2026-08-21.**

Split in two. **(a) the gate** is fixed; **(b) the quota** is deliberately left open pending a
product decision (hard block / bill the overage / measure first).

Proven end-to-end before fixing: cancel the trial on `/billing`, then
`POST /api/projects/prj_maakt_niet_uit/renders` → **503 from the render queue**, i.e. the request
sailed straight past billing and only stopped because Redis is absent in this environment. With
Redis running that is a free render for a cancelled organisation.

After the fix, the same request returns:

```json
{ "status": 402, "error": { "code": "subscription-required",
  "message": "Er loopt geen abonnement voor dit kantoor.", "errorId": "T7TP" } }
```

Fix: `startRenders()` (`src/lib/projects/renders.ts`) now loads the subscription via
`loadSubscription()` — which runs the clock, so an expired trial actually counts as expired — and
throws `subscription-required` when `hasBillingAccess()` is false. One place, because both the
editor's export button and the API route go through it. New error code in the catalogue
(`402`, `retry: NONE`), added to `AppErrorCode` and `ApiErrorCode`.

Two deliberate choices:
- **Only `opgezegd` is refused.** `achterstallig` still renders — the reasoning already lives in
  `hasBillingAccess()` and is a product decision, not an oversight. `tests/render-billing.test.ts`
  pins all five statuses by name so nobody "tidies" that away later.
- **Billing is checked before the queue check.** An office without a subscription should not be told
  that *our* queue is misconfigured.

Note for whoever implements (b): the dashboard counter cannot be reused as a limit.
`rendersInPeriod()` counts only jobs with `status === "done"`, so a thousand simultaneous requests
would all pass. A real quota needs a count on `queuedAt` in the render-job store. The render-id
idempotency works in our favour: re-exporting the same video is the same job and does not consume a
second render.

**B3 (original text) — Rendering is not gated on payment.**
`hasBillingAccess()` appears in exactly one place that matters — the *response body* of
`GET /api/billing/status` — and nowhere as a gate. `startRenders()` checks queue configuration,
project ownership and export-preset fit; it never checks subscription status, and there is **no
render quota enforcement at all** (`includedRendersPerMonth` is displayed only). An organisation
whose subscription is `opgezegd` can keep rendering and downloading indefinitely. Seat limits *are*
enforced (`lib/team/actions.ts`); render limits are not.

**B4 — Stored XSS via upload MIME. PROVEN — FIXED 2026-08-21.**

No longer a suspicion. Reproduced end to end against the running app:

```
POST /api/projects/prj_demo_leiestraat/assets   (payload.jpg, Content-Type: text/html)
  → 201, "mimeType":"text/html", "rejected":[]

GET /api/assets/ast_34b8a31356b6
  → 200  content-type: text/html
         content-disposition: inline
         (no X-Content-Type-Options)
  → <script>alert(document.domain)</script><h1>XSS-BEWIJS</h1>
```

Confirmed in the browser: `{ origin: "http://localhost:3010", contentType: "text/html",
h1: "XSS-BEWIJS", scriptAanwezig: true }` — parsed and rendered as HTML on the app's own origin.
Any user viewing that photo runs the attacker's script with their session.

Root cause was one word. `rejectionFor()` accepted a file when MIME **or** extension matched, so
`evil.jpg` with `text/html` passed; `uploadProjectAssets` then stored `file.type` verbatim; and
`/api/assets/:id` handed that straight back as `Content-Type` with `inline`.

Fixed in four layers, so no single mistake is enough:

1. `canonicalMimeType()` (`lib/uploads/validation.ts`) — the stored MIME now always comes from our
   own table. The extension only decides when the browser says nothing or `application/octet-stream`,
   which is the HEIC case that rule existed for. Aliases (`image/jpg`, `image/pjpeg`) are normalised
   so real photos are not refused.
2. `uploadProjectAssets` stores that canonical value, and passes it to `storage.put()` so the storage
   key's extension is not client-chosen either.
3. `/api/assets/:id` serves `Content-Type` from the allow-list, not from the row. Anything else —
   including rows created before this fix — gets `application/octet-stream` + `attachment`, plus
   `X-Content-Type-Options: nosniff`.
4. `next.config.ts` now sets `nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy` on every
   response. There were no security headers at all before. CSP is deliberately left out: it needs a
   nonce setup in Next, and a half-correct CSP mostly buys false confidence.

Both layers verified independently. The original upload now returns
`400 unsupported-media`. And with layer 1 temporarily reopened to recreate a `text/html` row, layer 3
still serves it as `application/octet-stream` + `attachment` + `nosniff` — so existing bad rows are
neutralised too.

`tests/upload-mime.test.ts` (10 tests) covers the attack, the HEIC regression, and the aliases.

**B4 (original text) — Uploads are served back with a client-controlled `Content-Type`, inline, same-origin.**
`uploadProjectAssets` stores `mimeType: file.type || "application/octet-stream"` — the browser's
claim, never re-validated against the allow-list. `partitionFiles` accepts a file when MIME **or**
extension matches, so `evil.jpg` carrying `Content-Type: text/html` passes. `GET /api/assets/:assetId`
then returns that stored MIME with `Content-Disposition: inline`, and there is no
`X-Content-Type-Options`. No security headers are configured anywhere (`next.config.ts` has no
`headers()`). Suspected stored XSS on the app origin. **NOT PROVEN** — needs a running server; this
is attack #1 for Phase 3.

**B5 — Object storage is not implemented. IMPLEMENTED 2026-08-21 — PARTLY PROVEN.**

Built as an S3-compatible adapter, which covers R2, Scaleway, MinIO, Backblaze and AWS. Three ports
were involved, not one: `UploadStorage`, `RenderStorage` and `RenderAssetSource`. All three already
had a clean interface, so this is three implementations over one shared client — no restructuring.

No SDK. AWS Signature V4 is implemented on Web Crypto (`src/lib/storage/signature.ts`), matching the
deliberate no-SDK choice made for Mollie. The decisive argument was testability: **AWS publishes
official test vectors, so the signature is provable without a bucket**, whereas an SDK cannot be
exercised at all without real credentials. Both vectors pass — the documented signing key
(`f4780e2d…db404d`) and `get-vanilla` from the aws-sig-v4-test-suite
(`5fa00fa3…fbf31`).

Design decisions:
- **The bucket is private.** Nothing needs a public object: every download already streams through
  the app so the permission check survives and files are named after the property. No presigned URLs.
- **Stored keys stay identical to the local ones** (`ast_x.jpg`, no folder). The bucket's folder is
  added only when talking to S3, so a row written today against local disk resolves against the
  bucket tomorrow with no migration.
- **Renders upload as a stream** with `UNSIGNED-PAYLOAD`; a 200 MB video must not cost 200 MB of RAM
  just to be hashed. Small uploads are hashed and signed in full.
- **The worker looks the key up** in `project_assets` rather than probing the bucket for extensions —
  one fewer round trip per photo, and no guessing that breaks on one HEIC in forty.

Proven with a stand-in S3 (`scripts/fake-s3.ts`) that the app talked to over real HTTP: upload →
`PUT /immoreel-test/uploads/ast_…jpg` with a valid `AWS4-HMAC-SHA256` signature over
`content-type;host;x-amz-content-sha256;x-amz-date`, then `GET /api/assets/:id` returned the bytes
identical to what went in. That run **found a real bug**: keys were stored with the folder prefix, so
uploading worked but reading back failed with "Deze opslaglocatie is onleesbaar" — the unit tests had
missed it because they exercised the client, not the port above it. Fixed, with a regression test
that was confirmed to fail with the bug reinstated.

**NOT PROVEN:** no request has ever reached a real S3 provider. The stand-in validates our side of
the conversation — URL shape, method, signed headers — not that AWS or R2 accept it. Before relying
on this, run one upload against the actual bucket. `STORAGE_ENDPOINT`, `STORAGE_FORCE_PATH_STYLE`
and the per-provider examples are in `.env.example`.

Also unchanged: this does **not** fix B11. The worker can now reach the *files* in its own process,
but still not the *rows* — those live in memory. That needs B1.

**B5 (original text) — Object storage is not implemented.**
`getUploadStorage()` throws 503 the moment `STORAGE_BUCKET` is set. Without it, files go to a local
directory that a containerised deploy loses on restart and that a second instance cannot read.
Renders write `file://` URLs to that same local disk.

**B6 — Sessions cannot be revoked.**
The token is stateless; `sid` is generated and never stored. `destroySession()` deletes the cookie
only. A captured token stays valid for its full 30 days: **logging out does not invalidate it, and
neither does a password reset** (`resetPasswordAction` revokes email tokens, not sessions). There is
no "sign out everywhere". Mitigating: role and membership are re-read per request, so *removing* a
user does cut them off immediately.

**B7 — Deletion does not exist.**
There is no route, action or store method to delete a project or an uploaded photo. The
`project:delete` permission is defined and never used. For a product that stores photographs of
private homes belonging to an agency's clients, "you can never remove a property" is both a
usability failure and a GDPR problem (Art. 17). Account deletion exists but knowingly orphans the
organisation's projects, renders, brand kit and invoices.

**B8 — Rate limiting is per-process and keyed on a spoofable header.**
`consumeAttempt` uses a `globalThis` Map (lost on restart, not shared between instances) and
`clientKey()` takes the first entry of `X-Forwarded-For` verbatim. Behind a proxy that does not
overwrite that header, the login limiter is bypassed by varying it. Nothing else in the app is rate
limited: not uploads, not render enqueue, not the SSE stream.

**B9 — No request size limit on uploads.**
`readFormFiles()` calls `request.formData()` before any size check, then
`new Uint8Array(await file.arrayBuffer())` loads each accepted file fully into memory. Next.js App
Router route handlers have no default body cap. 40 files x 25 MB = 1 GB resident per request, with
no concurrency limit.

**B10 — No optimistic concurrency on the editor document.**
No version field, no `updatedAt` precondition, no ETag anywhere in `lib/editor/document.ts`,
`lib/projects/patch.ts` or `use-autosave.ts` (grep returns nothing). `saveProjectPatch` writes the
whole document. Two tabs, or a colleague on the same project, means silent last-write-wins data
loss.

**B11 — The worker cannot run as a separate process.**
A consequence of B1, called out in `src/workers/README.md`. `RENDER_WORKER_INLINE=1` means FFmpeg
runs inside the web server process: CPU starvation of request handling, and a render crash takes the
site down with it.

**B12 — Zero automated tests.** See §5.

---

## 4b. Feature added: brand kit from the customer's website (2026-08-21)

`POST /api/brand-kit/discover` takes a URL and returns a **suggestion** — per field a value, its
source and a confidence score — which the user ticks and applies. Nothing is saved by this route;
applying only fills the form, and saving stays a separate click. That separation is deliberate: a
colour that looks right seven times out of ten is excellent as a suggestion and unusable as
something that happens silently.

What it reads: schema.org JSON-LD (`RealEstateAgent`/`LocalBusiness` → name, phone, email, logo),
`theme-color`, CSS custom properties whose names mention primary/brand/accent, Google Fonts links,
and `mailto:`/`tel:` as fallbacks. Neutral colours are filtered out by saturation — without that,
every office's brand colour becomes `#ffffff`. `hasEnoughContrast()` warns when the found colour
cannot carry white text on the end card.

**This feature exists to make our own server fetch a URL the user picks — i.e. textbook SSRF.**
Four locks, in `src/lib/brand/discover/net.ts`:

1. Scheme must be http/https, checked *before* the "add https://" convenience step.
2. The IP is vetted **inside the DNS lookup** (`node:https` with a custom `lookup`), not before it,
   so the address that gets approved is the address that gets connected to — closing DNS rebinding.
3. Every redirect hop is re-vetted.
4. Timeout (8 s), body cap (2 MB), `accept-encoding: identity` so a gzip bomb cannot bypass the cap.
   Plus a per-organisation rate limit of 10 sites per 15 minutes on the route.

Blocked ranges: loopback, RFC1918, link-local (169.254 — cloud metadata), CGNAT, 0.0.0.0, multicast,
IPv6 equivalents, and IPv4-mapped IPv6 in **both** notations.

**The tests found four real bugs before this shipped, three of them security holes:**
`http://[::1]:6379` passed (Node returns IPv6 hosts with brackets, so `isIP()` said "not an IP");
`::ffff:127.0.0.1` passed (Node normalises it to the hex form `::ffff:7f00:1`, which the decimal
pattern missed); and `file:///etc/passwd` passed (the scheme prefixer turned it into a valid
`https://` URL). The fourth was functional — Google Fonts was consuming the stylesheet budget.

Proven: SSRF refusals through the real HTTP route (`400` for `127.0.0.1:6379` and for
`169.254.169.254`), refusal of a real local server on loopback, refusal of a redirect pointing
inward, extraction against realistic markup, and the full assembly through an injected fetcher.
25 tests in `tests/brand-discover.test.ts`.

**Then it was run against a real site, and found three more bugs — including one that made the
whole feature fail for every address that exists.**

The first report was "we konden de site niet bereiken" for everything. Cause: Node's HTTP client
calls the custom `lookup` with `all: true` itself and then expects an **array** back; returning a
single address yields `ERR_INVALID_IP_ADDRESS: undefined`. Every real fetch failed.

Why 25 green tests missed it: every one of them exercised an address that *should* be refused, and
those are rejected in `parsePublicUrl()` before the lookup is ever reached. **A suite that only
tests refusal does not prove that acceptance works.** The regression test now calls the lookup the
way Node does.

The other two only surfaced against real markup: HTML entities were never decoded (`Belgium&#039;s`
went straight into the suggestion — an office called "Janssens &amp; Zonen" would have had that in
its video), and the stylesheet filter required an exact host match, so a site serving CSS from
`assets.example.be` while the page sits on `www.example.be` had its colours thrown away. Own domain
now sorts first instead of being the only option; font services are excluded.

Proven against a real site (immoweb.be) end to end, through the browser: primary `#315ed1` (their
actual blue), secondary `#a8beea`, correct logo URL, name with the apostrophe decoded. Confidence on
the colours was 0.4 — the CSS variables are not named "primary" — so the checkboxes correctly
defaulted to off with "niet zeker, kijk dit na". 32 tests.

### Revised on four real agency sites (2026-08-21)

Measured against buytaertimmo.be, neonvastgoed.be, sorenco.be and immoweb.be. **None of the four had
CSS custom properties** — the assumption the first version was built on. Their brand colours sit in
ordinary hex in the stylesheet, so colour extraction is now primarily a frequency count with
neutrals filtered out. Four changes:

1. **Frequency counting** on plain hex/rgb. Sorenco's `#002e5e` (59×) and `#c4a163` (46×) are exactly
   their navy and gold.
2. **The primary colour must carry white text.** It becomes the background of the intro and end
   cards. Neon calls its neon green `--primary`, but that is an accent — putting a title on it is
   unreadable. The ranking now prefers a candidate with sufficient contrast and explains the swap.
3. **Dark site colours are eligible as background.** Buytaert runs a black site with yellow accent;
   `isNeutral` was throwing the black away, so the end card became yellow-on-white. A separate
   dark-candidate list fixes that — result `#1c1c1b` + `#ffe900`, which is their site.
4. **Stylesheet selection.** One site has fourteen stylesheets and the first three picked were
   `bootstrap.css`, `k2.css` and `consent.css` — three files of someone else's greys. Known
   libraries now sort last, own domain first, budget raised from 3 to 5 files.

Also fixed: page titles gave "Home" (from "Home | Buytaert immo consulting") — generic segments are
now skipped and the shortest remaining part wins; and `mailto:` entities were not decoded, so
sorenco.be produced `&#105;&#110;&#102;...` instead of `info@sorenco.be`.

Result on all four: correct brand colour, correct accent, correct name.

### Logo import

`POST /api/brand-kit/discover/logo` downloads the logo through the same SSRF-guarded fetcher, checks
**both** the content type and the file's magic bytes (a 404 page served as `image/png` is normal),
and writes it to our own storage. `GET /api/brand-kit/logo/[key]` serves it back — a separate route
because a logo belongs to the organisation, not a project, so `/api/assets/:id` (which reads
`project_assets`) cannot serve it. The key carries the organisation id and the route refuses keys
that do not match the caller's office.

SVG is deliberately refused: it is a document that can carry script, arriving from a site we do not
control. Immoweb's logo is SVG and gets a clear "upload it yourself" instead. The other three
imported cleanly.

**Discovered while building this:** the existing logo upload field uses `createFakeTransport()` —
**logo uploads have never actually been stored.** The brand kit keeps a blob URL that does not
survive a reload. The import path above writes real files; the manual upload field still does not.
That is a separate fix (P1) and is not addressed here.

### Measured on nine real agency sites

Five more sites (vbvastgoed, lefevervastgoed, heylenvastgoed, dewaele, vastgoed03 — two of them deep
listing pages rather than homepages) surfaced four more bugs:

- **`<title>` of an SVG icon won.** One site has two `<title>` elements inside its `<head>`: first
  `icon-check` from an inline pictogram, then the real one. The office was named "icon-check".
  SVG blocks are now stripped before the title is read, and `og:title` is preferred over `<title>`.
- **Inline CSS was ignored.** A framework-built site puts all its CSS in one `<style>` block; the
  frequency counter only looked at linked stylesheets, so that site yielded no colours at all.
- **"Shortest title segment" picked the slogan.** "Lefever Vastgoed uit Kapellen | Omdat vastgoed
  mijn passie is" — the slogan is one character shorter than the name. Now the *first*
  non-generic segment wins, which is where an office puts its name.
- **A single logo candidate is not enough.** One office's own schema.org points at a `logo.png` that
  404s. `readLogoCandidates()` now returns a ranked list and the import walks it.

Final measurement across all nine sites:

| Field | Hit rate |
| --- | --- |
| Brand colour | **9/9** |
| Office name | **9/9** |
| Phone or email | 5/9 |
| Logo imported | 6/9 |

The three logo misses are all SVG, which is refused by design. Colour and name are now reliable
enough to lead with; contact details are a bonus when the office publishes structured data.

### A tenth site exposed a systematic error — and corrected the earlier measurement

sensumvastgoed.be returned `#007aff` (blue) as its brand colour with `#d4af37` (gold) demoted to
accent. The user asked whether that blue was left over from a previous lookup. It was not — proven
by running the same site twice with a different site in between, byte-identical result — but the
question was the right one, because the value really did not belong to that office.

`#007aff` is `--swiper-theme-color`: the default of the Swiper carousel library, Apple's system
blue, identical on every site that uses it. It won because `PRIMARY_HINTS` contains `"theme"`, and a
named variable outranked a colour appearing **107 times** in the same stylesheet — which was the
office's actual gold.

Three corrections:

1. **Library variables are excluded** (`--swiper-`, `--bs-`, `--mui-`, `--fa-`, `--tw-`, `--wp--`,
   `--ion-`, `--chakra-`, `--mantine-`). Their names describe a framework, not an office.
2. **Frequency now carries weight.** ≥50 occurrences scores as high as a well-named variable, ≥15 as
   high as a secondary hint. A name is a hint; a hundred occurrences are a pattern.
3. **Entities in attribute URLs are decoded.** A `&` inside an HTML attribute is written `&amp;`, and
   a framework's image resizer puts exactly that in its URL
   (`?url=...&amp;w=3840&amp;q=75`). The logo download was requesting a literally broken address —
   which is why sensumvastgoed's logo "could not be found".

**This also invalidates part of the earlier 9/9 claim.** dewaele.com had been recorded as correct
with `#007aff` — that was Swiper blue too. Their actual brand is red/magenta (`#e40046`), confirmed
by looking at their site. The previous measurement was too optimistic because the colours were never
checked against the sites visually. Logo import went from 6/9 to 7/10.

**Still NOT PROVEN:** ten sites is a small sample, and the heuristics have been tuned *on* these
ten — the risk of fitting to the sample is real. Colour correctness has now been visually confirmed
for three of the ten; the rest are plausible but unverified. The confidence scores are calibrated by judgement,
not by data. A JavaScript-only site still returns nothing, handled as an explanation rather than an
error. The `.be` estate-agency sites customers will
actually paste in are mostly WordPress and agency CMSes, and the hit rates in the table above are
estimates, not measurements. A JavaScript-only site returns nothing, which is handled as an
explanation rather than an error.

## 5. Missing testing infrastructure

There was **nothing** at baseline. Fixing B0 added a first foothold — `tests/session-loop.test.ts`,
9 tests, run with Node's built-in runner through tsx (`npm test`), no new dependencies. It covers
the redirect loop and the route-table invariants that keep it fixed, and it includes a live HTTP
check that forges a signed cookie for a non-existent user and counts the redirect hops.

That is one file. Still missing: fixtures, factories, CI configuration, Playwright, a fake Mollie, a
`docker-compose.yml` for Redis, and a seeded test database (because there is no database).

Concretely missing:

- **Runner and assertions** — none installed.
- **Unit-testable surface that is currently untested.** This is the frustrating part: the codebase
  is full of pure functions that are trivial to test and worth testing — `lib/team/rules.ts`,
  `lib/account/rules.ts`, `lib/billing/plans.ts` (VAT rounding), `lib/billing/changes.ts`
  (pro-rata), `lib/billing/status.ts`, `lib/auth/config.ts#safeRedirectPath`,
  `lib/auth/password.ts`, `lib/auth/tokens.ts`, `lib/render/fingerprint.ts`, `lib/editor/motion.ts`,
  `lib/editor/export-presets/*`, `lib/uploads/validation.ts`, `lib/exports/zip.ts`.
- **An HTTP-level integration harness.** There is no way to call a route handler with a forged,
  absent or foreign session. Every authorization claim in this document is currently a claim about
  *code I read*, not about *behaviour I observed*.
- **A fake Mollie.** No recorded fixtures for `getPayment`, no way to replay a webhook, no way to
  test duplicate, reordered or out-of-order webhooks.
- **Redis and BullMQ in CI.** No compose file, no in-memory queue substitute.
- **FFmpeg fixtures.** The fake backend exists (`RENDER_BACKEND` unset) and is the right hook, but
  nothing drives it.
- **End-to-end.** No browser automation for signup -> project -> upload -> edit -> render ->
  download.

---

## 6. Areas that require manual testing

1. Real Mollie sandbox: Bancontact/SEPA `first` payment, mandate creation, webhook delivery over a
   public tunnel, and a SEPA payment that sits on `pending` for days.
2. Real FFmpeg output: whether the rendered video actually matches the editor preview — the central
   product promise — per aspect ratio and per platform preset.
3. Behaviour across a server restart. Data loss is expected; the open question is whether the UI
   *degrades honestly*. Two pages already show a "your project is gone" empty state, which suggests
   it partly does.
4. Multi-instance behaviour — cannot be simulated without a database.
5. Email deliverability, spam placement, link correctness — no provider exists.
6. Browser matrix for the editor: drag-and-drop reorder uses a custom `dataTransfer` type,
   `EventSource` behind corporate proxies, HEIC previews on non-Apple browsers.
7. Accessibility and keyboard navigation of the editor and the wizard.
8. Mobile. Whether the editor is usable at all on a phone, which is where an agent standing inside a
   house actually is.

---

## 7. What Phase 0 does not claim

Per Rule 10: everything in §4 is derived from reading source code. Nothing has been executed against
a running instance. B3 (unpaid rendering), B4 (stored XSS), B8 (rate-limit bypass), B9 (upload DoS)
and B10 (lost update) are **NOT PROVEN** and are the first five things to attack in Phases 2–4.

Equally, no claim is made here that anything is *secure*. Multi-tenancy looks correct in every file
I read, and that is exactly the kind of statement Phase 15 exists to falsify.
