# SpinSync 🎾

Tennis court & coach booking platform. Built with Next.js 14 App Router, Supabase, and Tailwind CSS.

## Stack

| Layer    | Tech                                      |
| -------- | ----------------------------------------- |
| Frontend | Next.js 14 (App Router) + TypeScript      |
| Styling  | Tailwind CSS · DM Sans / DM Serif Display |
| Database | Supabase (PostgreSQL + RLS)               |
| Auth     | Supabase Auth (email + Google OAuth)      |
| Email    | Resend (wire up next)                     |
| Payments | Stripe-ready (add when needed)            |
| Deploy   | Vercel + Supabase                         |

## Project structure

```
src/
├── app/
│   ├── (auth)/login/         # Sign in
│   ├── (auth)/signup/        # Sign up + email confirm
│   ├── (dashboard)/dashboard/# Player bookings dashboard
│   ├── api/
│   │   ├── auth/callback/    # OAuth callback
│   │   ├── bookings/         # POST create · GET list (with conflict check)
│   │   └── courts/           # GET list (filterable + booked slots by date)
│   ├── courts/               # Listing + [id] detail/booking
│   ├── coaches/              # Listing with level filter
│   └── page.tsx              # Homepage (live stats from DB)
├── components/
│   ├── layout/Navbar.tsx     # Auth-aware nav
│   └── booking/BookingForm.tsx # Slot picker client component
├── lib/supabase/
│   ├── client.ts             # Browser client
│   ├── server.ts             # Server component client
│   └── admin.ts              # Service role (API routes only)
├── middleware.ts              # Protect /dashboard, /bookings, /profile
└── types/database.ts         # Hand-written types (replace with generated)
supabase/
└── schema.sql                # Full DB schema — run this first
```

## Quick start

### 1. Install

```bash
npm install
```

### 2. Create Supabase project

1. New project at [supabase.com](https://supabase.com)
2. **SQL Editor** → paste & run `supabase/schema.sql`
3. **Authentication → Providers** → enable Google (optional)
4. **Authentication → URL Configuration** → add `http://localhost:3000/api/auth/callback`

### 3. Environment

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=re_...
```

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

### 5. Generate proper Supabase types (recommended)

```bash
npx supabase gen types typescript --project-id <your-project-id> \
  > src/types/database.ts
```

## Plans and billing

Clubs pay Kortello; players never do. Every new club gets **1 month free with
everything unlocked**, then one of these plans (prices live in `src/lib/plans.ts`):

| Plan    | Price            | Courts    | Adds                                                      |
| ------- | ---------------- | --------- | --------------------------------------------------------- |
| Starter | €9/mo · €90/yr   | up to 3   | bookings, unlimited members, confirmation emails          |
| Club    | €19/mo · €190/yr | up to 8   | membership plans, coaches, reminder emails, weekly report |
| Academy | €45/mo · €450/yr | unlimited | analytics (multiple admins coming)                        |

- The court limit is enforced by the database (`supabase/migrations/20261013_plans_trial.sql`).
  Keep its numbers in step with `src/lib/plans.ts`.
- Club owners can't change their own plan; only the SQL Editor / service role can.
- Billing is by hand for now. When a club pays:

  ```sql
  update public.clubs set plan = 'club', paid_until = '2026-12-31' where slug = 'their-slug';
  ```

- When the trial ends unpaid nothing is switched off: the club drops to its plan's
  limits and sees a "trial has ended" banner until `paid_until` is set.

## Open matches

Players book a court and open it to others at their level ("we need two more
for padel at 19:00"). Everyone pays their share at the club; Kortello takes
nothing. Included in every plan.

- **Database:** run `supabase/migrations/20261026_open_matches.sql` once in the
  SQL Editor. The court is the organiser's ordinary booking, so booking rules,
  opening hours, no-shows and the timetable work as before.
- **Levels:** each player sets a level per sport (1.0 to 7.0). A club can confirm
  it from Admin > Open matches, and players then see "Checked by <club>".
- **Courts that don't fill:** a few hours before the start (6, 12 or 24, set by
  the club) the organiser is asked whether to keep the court. With no answer it
  is given back and goes on sale again. The hourly job (`/api/cron`) does this.
- **Pages:** `/matches` (list), `/matches/new`, `/matches/[id]`, `/matches/level`
  for players, `/admin/matches` for the club. Clubs' public pages list matches
  that still need players.

## Closing courts

A club closes one or more courts (or the whole club) for a time: repairs, rain,
a tournament, a holiday. Nobody can book them then, from any screen.

- **Database:** run `supabase/migrations/20261027_court_closures.sql` once in the
  SQL Editor, after the open matches file.
- **Where:** "Close courts" on Admin > Courts (with the list of closures) and on
  the timetable, where closed times show as grey stripes. Clubs' public pages
  list closures in the next 30 days.
- **What it cancels:** bookings already in that time are cancelled. Players get a
  notification and an email with the reason; a group's session is cancelled the
  usual way, so parents hear too. A lesson moves to another free court only when
  it's booked; existing lessons on a closed court are cancelled.
- **Reopening** deletes the closure. Cancelled bookings stay cancelled.

## Court colours

Each court can have its real colour (blue, blue-green, green, terracotta, red, purple, grey),
picked in Admin > Courts. The booking page draws the court in that colour and
says it ("Hard · Blue"). Run `supabase/migrations/20261027b_court_colors.sql`
once; courts without a colour use their surface's usual one.

## Online payments (Stripe)

Players can pay for a court when they book. Each club connects **its own**
Stripe account (Stripe Connect, "direct charges"): the money goes straight to
the club, and refunds, disputes and Stripe's fees are the club's. Kortello can
take a cut with `KORTELLO_FEE_PERCENT` (none by default).

- **Database:** run `supabase/migrations/20261029_online_payments.sql` once,
  after the leagues file.
- **Package:** `npm install` (adds `stripe`).
- **Environment** (`.env.local`, and the same in Vercel):

  ```env
  STRIPE_SECRET_KEY=sk_test_...          # Stripe → Developers → API keys
  STRIPE_WEBHOOK_SECRET=whsec_...        # from the webhook below
  # KORTELLO_FEE_PERCENT=0               # optional: your cut of each payment
  ```

- **Webhook:** Stripe → Developers → Webhooks → Add destination → **Connected
  accounts** → `https://<your site>/api/stripe/webhook`, with the events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.expired`, `charge.refunded` and `account.updated`. Copy its
  signing secret into `STRIPE_WEBHOOK_SECRET`.
- **Testing on your computer:** install the Stripe CLI and run
  `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`; it
  prints a `whsec_…` to use as `STRIPE_WEBHOOK_SECRET` while it runs. (Paying
  works without it too: the page Stripe sends the player back to confirms the
  booking. The webhook covers players who close the tab, and expiry.)
- **Turning it on for a club:** Admin > Settings > Payments > Connect Stripe,
  fill in Stripe's form (in test mode Stripe offers test data), then choose
  "Online, when booking" or "Player chooses". Pay with the card
  `4242 4242 4242 4242`.
- **How it works:** booking at a club that takes payment online holds the court
  for 31 minutes (status _pending_) and sends the player to Stripe's checkout.
  Paying confirms it and tells the club; not paying frees the court (webhook,
  "Back" on Stripe's page, or the hourly job). Cancelling a paid booking (the
  player, the club, or a court closure) refunds it automatically. Lessons,
  group sessions and bookings the club makes are still paid at the club.
- **Countries:** a club's Stripe account has to be in a country Stripe supports
  (stripe.com/global); North Macedonia isn't one yet. Your own Kortello Stripe
  account (the platform) also needs a supported country, e.g. a US company.

## Clubs paying for Kortello by card (Polar)

Clubs can pay for their Kortello plan by card, monthly or yearly, in
Settings → "Pay by card". Polar is the merchant of record: it charges the card,
handles VAT, sends invoices, and pays out to you (North Macedonia included).
Bank transfers and cash still work, recorded on the owner page as before.

- **Database:** run `supabase/migrations/20261029b_polar_subscriptions.sql` once.
- **Package:** `npm install` (adds `@polar-sh/sdk`).
- **In Polar** (use sandbox.polar.sh while testing): create six recurring
  products, Starter / Club / Academy, each monthly and yearly, at the prices in
  `src/lib/plans.ts`. Create an organization access token, and a webhook to
  `https://<your site>/api/polar/webhook` with the `subscription.*` and
  `order.paid` events.
- **Environment:**

  ```env
  POLAR_ACCESS_TOKEN=polar_oat_...
  POLAR_WEBHOOK_SECRET=...
  POLAR_SERVER=sandbox                  # "production" when live
  POLAR_PRODUCT_STARTER_MONTH=...       # product ids from Polar
  POLAR_PRODUCT_STARTER_YEAR=...
  POLAR_PRODUCT_CLUB_MONTH=...
  POLAR_PRODUCT_CLUB_YEAR=...
  POLAR_PRODUCT_ACADEMY_MONTH=...
  POLAR_PRODUCT_ACADEMY_YEAR=...
  ```

- **How it works:** the checkout is made for the club (Polar customer id = the
  club's id). A club still in its free trial isn't charged until the trial
  ends. The webhook sets the club's plan and `paid_until` to the end of the
  paid period, and every payment appears on the owner page with method "Card".
  A failed renewal leaves `paid_until` as it was, so the usual 3 grace days
  apply. "Manage subscription" opens Polar's page to change plan or card,
  download invoices or cancel.
- **Testing on your computer:** Polar can't reach localhost; use a tunnel
  (e.g. `ngrok http 3000`) for the webhook, or test on a Vercel preview.

## Americano and Mexicano evenings

Social padel (or pickleball, tennis doubles) evenings: everyone signs up alone,
partners change every round, and each player keeps the points their side wins.

- **Database:** run `supabase/migrations/20261030_americano.sql` once.
- **Where:** Admin > Americano. Pick the courts and times: they're booked for the
  evening so nobody else takes them. Share the link (`/americano/<id>`);
  players sign up there and, on the night, follow the rounds and table live
  (the page reloads every 20 seconds, good on a TV at the club too).
- **Rounds:** "Start round" makes the next round. Americano keeps partners and
  opponents as varied as possible (8 players on 2 courts: everyone partners
  everyone once in 7 rounds); Mexicano groups players by points after round 1
  (1st and 3rd against 2nd and 4th on the top court). With more players than
  places, players take turns sitting out and get half a game's points.
- **Scores:** the club, or a player in the game, enters one side's points; the
  other side gets the rest. The logic is in `src/lib/americano.ts`.

## Levels that move with results

- **Database:** run `supabase/migrations/20261030c_levels_from_results.sql` once
  (after the Americano and tournament pairs migrations).
- Each player level (1.0–7.0) has a precise rating behind it. Every league
  match and Americano game with a score moves the rating of the players who
  have a level for that sport, Elo-style: beating a stronger side moves it
  most; a side 1.0 better is expected to win 3 games in 4. Others see the level
  rounded to the nearest half; the player sees the rating and the latest
  changes on their level page.
- Every change is kept in `level_changes`, so correcting or clearing a score
  (or a walkover) undoes it exactly. A player choosing a new level by hand
  restarts the rating from there.

## Tests and CI

Every push to GitHub runs `.github/workflows/ci.yml`: types, lint, unit
tests and a build, plus the database tests on a fresh Postgres. The result
shows as ✓ or ✗ next to the commit (click it to see what failed).

- **Unit tests** (`tests/unit`, [Vitest](https://vitest.dev)): the app's own
  logic, such as Americano rounds, tournament draws, booking rules, plan and
  trial status, CSV export, and all 7 translation files (same texts, valid
  `{placeholders}`). Run them with `npm test`, or `npm run test:watch` to
  re-run on every save.
- **Database tests** (`tests/db/*.test.sql`): build the whole database from
  `supabase/schema.sql` and every migration, then act as different people to
  check the security rules and functions: a player can't read others'
  bookings or mark a booking paid, clubs can't see each other's data, closing
  courts cancels the right bookings, league and Americano scores move levels,
  and so on. They need a Postgres, so they run in CI
  (`npm run test:db` works on a machine with Postgres 16+).
- **Writing a check:** see the comment at the top of `tests/db/helpers.sql`,
  e.g. `select test.login('eli');` then
  `select test.fails($$...$$, 'what must not work');`.

`tests/db/setup/dashboard.sql` recreates what was once set up by hand in the
Supabase dashboard (the members tables, owner booking rules, the "no double
booking" rule), since no migration has it. To compare it with the live
database, run this in the Supabase SQL Editor:

```sql
select tablename, policyname, cmd, qual, with_check from pg_policies
where tablename in ('members', 'membership_plans', 'bookings') order by 1, 2;
select relname, relrowsecurity from pg_class
where relname in ('members', 'membership_plans', 'bookings');
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.bookings'::regclass and contype = 'x';
```

## What's built

- [x] Homepage with live court/coach/club counts
- [x] Courts listing — filter by surface & indoor/outdoor
- [x] Court detail + slot picker booking form
- [x] Coaches listing — filter by level
- [x] Email/password auth + Google OAuth
- [x] Player dashboard — upcoming & past bookings
- [x] Booking API with slot conflict detection
- [x] Courts API with booked-slots-by-date
- [x] Auto-create profile on signup (DB trigger)
- [x] Row Level Security on every table
- [x] Route protection middleware

## What's next

- [ ] Coach detail + booking page
- [ ] Email confirmations via Resend
- [ ] Club admin dashboard (manage courts, view bookings)
- [x] Online payments with Stripe Connect (test mode until Kortello has a Stripe-supported company)
- [ ] Availability rules per court/coach
- [ ] Real-time availability via Supabase Realtime
- [ ] Vercel deployment
