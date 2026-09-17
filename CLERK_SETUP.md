# Clerk Setup — Authentication From Zero

Everything needed to wire a fresh Clerk application to CampusHire: account,
keys, the session-token setting this app depends on, webhooks, the first Super
Admin, and verification.

Read [NEON_SETUP.md](NEON_SETUP.md) first if the database does not exist yet —
the two are linked, and Clerk's webhook writes into the `User` table.

---

## How auth works here, in one page

Clerk owns credentials. The app owns roles. They are kept in sync in both
directions, and knowing which direction is authoritative matters:

```
   Clerk (source of truth for identity)
        │
        │  user.created webhook
        ▼
   User table  ── clerkId, email, role ──┐
        │                                │
        │  role written back to Clerk    │
        └──> publicMetadata.role         │
                     │                   │
                     ▼                   ▼
             middleware.ts        server actions
          (fast routing check)  (real authorization)
```

- **`User.role` in Postgres is authoritative.** Every server action and query
  re-checks it through `lib/auth.ts`.
- **`publicMetadata.role` in Clerk is a cache**, used by `middleware.ts` for a
  fast routing decision without a database round trip. It can be stale; it is
  never trusted for authorization.
- A user with **no** role in metadata is deliberately allowed through
  middleware, because the webhook may not have run yet. The server-side check
  is what actually stops them.

That last point is why the session-token step below matters more than it looks.

---

## Step 1 — Create the account and application

1. Go to <https://dashboard.clerk.com> and sign up.
2. **Create application**:
   - **Name**: `CampusHire`
   - **Sign-in options**: enable **Email**. Enable **Google** only if you want
     students signing in with personal Google accounts — the app matches
     students to the imported roster by their **verified email**, so whichever
     method they use must produce the college email that is on the roster.
3. Choose **Next.js** when it offers a framework.

### Email verification

**Email → Email verification code (OTP)** is the right default. The app's
registration flow assumes the email is verified, because the roster match keys
on it — that is the one value an applicant cannot forge.

---

## Step 2 — Copy the API keys

**Dashboard → API Keys**, Next.js tab:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

`pk_test_` / `sk_test_` are development keys. Production gets separate
`pk_live_` / `sk_live_` keys from a production instance — see Step 8.

---

## Step 3 — Update `.env.local`

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx   # from Step 5

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

The redirect URLs point at `/`, not at a dashboard, on purpose: the landing
page reads the session and sends each role to its own dashboard. Pointing them
at `/student-dashboard` would send admins to a page they are bounced out of.

`lib/env.ts` validates these at startup with Zod and fails loudly if one is
missing — except `CLERK_WEBHOOK_SECRET`, which is optional so local development
works before webhooks are set up.

---

## Step 4 — The session-token setting this app depends on

**This is the step everyone misses, and it fails silently.**

`middleware.ts` and `lib/clerk.ts` both read the role from
`sessionClaims.publicMetadata`. Clerk does **not** put `publicMetadata` in the
session token by default — so without this setting, `role` is always
`undefined`.

Because the app deliberately lets role-less users through middleware (the
webhook may not have run yet), the failure mode is not an error. It is
**every authenticated user passing every middleware check**, with only the
server-side database checks holding the line. The app stays secure, but role
routing stops working and nothing tells you why.

**Dashboard → Sessions → Customize session token → Edit**, and set:

```json
{
  "publicMetadata": "{{user.public_metadata}}"
}
```

Save. Existing sessions pick it up on their next refresh (about a minute), or
sign out and back in.

**Verify it took effect** — sign in, then in the browser console:

```js
await window.Clerk.session.getToken().then(t =>
  JSON.parse(atob(t.split('.')[1]))
)
```

You should see `publicMetadata` in the payload. After Step 7 it will contain
`{ role: "SUPER_ADMIN" }`.

---

## Step 5 — Webhooks

The webhook creates the `User` row when someone signs up. Without it the app
still works — `getOrCreateUser()` in `lib/auth.ts` creates the row on first
request as a fallback — but that fallback costs an extra Clerk API call on a
user's first page load, and it exists for webhook failures, not as the norm.

### For a deployed app

1. **Dashboard → Webhooks → Add Endpoint**
2. **Endpoint URL**: `https://your-domain.com/api/webhooks/clerk`
3. **Subscribe to**: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** (`whsec_...`) into `CLERK_WEBHOOK_SECRET`.

### For local development

Clerk cannot reach `localhost`. Expose it:

```bash
npx ngrok http 3000
```

Use the forwarded URL — `https://xxxx.ngrok-free.app/api/webhooks/clerk` — as
the endpoint. The URL changes each time ngrok restarts, so update the endpoint
when it does.

The route verifies every request's signature with `svix` and rejects anything
unsigned, so the secret must match the endpoint it came from.

### The three events

| Event | What the app does |
|---|---|
| `user.created` | Creates the `User` row with role `STUDENT`, writes the role back to `publicMetadata` |
| `user.updated` | Syncs the email onto the `User` row |
| `user.deleted` | Handles removal (note `AuditLog → User` is `Restrict` — a user with audit history cannot be deleted) |

---

## Step 6 — First sign-up

```bash
npm run dev
```

Go to <http://localhost:3000/sign-up> and register with the email that should
own the Super Admin account. Use a real address — verification is by OTP.

You will land on the student dashboard's registration card. **Do not fill it
in.** You are about to become an admin, and an admin with a leftover `Student`
row shows up in the roster and in placement counts.

---

## Step 7 — Promote yourself to Super Admin

```bash
npx tsx scripts/make-super-admin.ts your-email@example.com
```

This finds the `User` row, sets `role = SUPER_ADMIN`, writes the role into
Clerk's `publicMetadata`, and retires any leftover `Student` row. It refuses if
that student holds applications, because `DriveApplication` cascades on
`Student` delete and would destroy the history.

Sign out and back in — the session token needs to refresh before middleware
sees the new role. Then confirm `/super-admin-dashboard` loads.

### The other role scripts

```bash
npx tsx scripts/make-dept-admin.ts <email> <department-code>  # department admin
npx tsx scripts/verify-admin.ts <email>                       # show a user's current role
npx tsx scripts/sync-role-to-clerk.ts <email>                 # re-push that user's DB role to Clerk
```

`sync-role-to-clerk.ts` is the repair tool when `publicMetadata` has drifted
from the database — for example after restoring a database backup, which leaves
Clerk holding roles from a different point in time. It works **one user at a
time**, so for several accounts you run it per email.

---

## Step 8 — Production instance

Clerk development instances are not for real users: relaxed security, shared
dev domain, and they can be reset.

1. **Dashboard → top-left environment switcher → Create production instance**
2. Add your production domain and the DNS records Clerk gives you
3. Copy the `pk_live_` / `sk_live_` keys into your hosting provider's env vars
4. **Re-do Step 4** — the session-token customisation does **not** carry over
5. Add a webhook endpoint for the production domain, with its own signing
   secret
6. Run `make-super-admin.ts` again against production — users do not transfer
   between instances

Step 4 not carrying over is the single most common production breakage here.

---

## Verify the whole chain

| Check | How | Expected |
|---|---|---|
| Keys load | `npm run dev` | No env validation error at startup |
| Sign-up works | Register a throwaway email | OTP arrives, lands on the app |
| Webhook fires | Clerk → Webhooks → Logs | `user.created`, `200` |
| `User` row created | `npx tsx scripts/verify-db.ts` | User count went up |
| Role in token | Browser console snippet from Step 4 | `publicMetadata.role` present |
| Middleware routes | Visit `/admin-dashboard` as a student | Redirected to `/` |
| Server auth holds | — | Server actions re-check the database regardless |

---

## Prompts to hand me

### After the keys are in `.env.local`

```
I've set up a new Clerk application and put the keys in .env.local. Verify the
app boots, the env validation passes, and the sign-in page renders. Then tell
me what's still missing before I can sign up.
```

### After signing up

```
I signed up as <email>. Check whether the Clerk webhook created the User row,
and if it didn't, tell me whether getOrCreateUser fell back correctly. Then
promote me to SUPER_ADMIN and confirm the role reached Clerk publicMetadata.
```

### If role routing misbehaves

```
Role routing isn't working — I'm reaching dashboards I shouldn't, or being
bounced from ones I should reach. Check whether publicMetadata is actually in
the session token, whether the User role in Postgres matches Clerk's
publicMetadata, and tell me which of the two is wrong before changing anything.
```

### After restoring a database backup

```
I restored the database from a backup. Clerk publicMetadata may now disagree
with User.role in Postgres. Compare them for every user and show me the
mismatches. Don't sync anything until I've seen the list — then run
sync-role-to-clerk.ts for each address I confirm.
```

### Testing the student flows

```
I want to test the student experience end to end. Walk me through creating a
test student — bulk import a roster row first, then sign up with that email so
the roster match path is exercised, not the access-request path. Tell me what
to click; I'll do the signing in.
```

> I cannot enter passwords or sign in on your behalf — that limit does not
> move. Set up the session yourself and I can drive the app from there.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Env validation throws at startup | A `NEXT_PUBLIC_CLERK_*` key missing | Compare `.env.local` against `lib/env.ts` |
| Everyone reaches every dashboard | `publicMetadata` not in the session token | Step 4 |
| Role change has no effect | Session token is stale | Sign out and back in |
| Webhook returns 400 | Signing secret does not match the endpoint | Re-copy `CLERK_WEBHOOK_SECRET` |
| Webhook never fires locally | Clerk cannot reach localhost | ngrok, and update the endpoint URL |
| User signs up but no `User` row | Webhook not configured | Fine locally — `getOrCreateUser` covers it |
| Admin appears in the student roster | Leftover `Student` row | `make-super-admin.ts` retires it; re-run it |
| Roles wrong after a DB restore | Clerk holds roles from another point in time | `npx tsx scripts/sync-role-to-clerk.ts` |
| `Cannot delete user` | `AuditLog → User` is `Restrict` | Intentional — audit history is not deletable |

---

## Checklist

- [ ] Clerk account created, application `CampusHire`
- [ ] Email sign-in enabled, OTP verification on
- [ ] `pk_test_` / `sk_test_` keys in `.env.local`
- [ ] Redirect URLs set, all pointing at `/`
- [ ] **Session token customised with `publicMetadata`** ← the one that fails silently
- [ ] Webhook endpoint added, 3 events subscribed, secret copied
- [ ] Signed up once, `User` row confirmed
- [ ] Promoted to Super Admin, signed out and in again
- [ ] `/super-admin-dashboard` loads
- [ ] Departments created — see [NEON_SETUP.md](NEON_SETUP.md)
- [ ] Production instance done separately when you deploy, **including Step 4 again**
