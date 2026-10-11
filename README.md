# ServeTime 🎾

Tennis court & coach booking platform. Built with Next.js 14 App Router, Supabase, and Tailwind CSS.

## Stack

| Layer    | Tech                                        |
|----------|---------------------------------------------|
| Frontend | Next.js 14 (App Router) + TypeScript        |
| Styling  | Tailwind CSS · DM Sans / DM Serif Display   |
| Database | Supabase (PostgreSQL + RLS)                 |
| Auth     | Supabase Auth (email + Google OAuth)        |
| Email    | Resend (wire up next)                       |
| Payments | Stripe-ready (add when needed)              |
| Deploy   | Vercel + Supabase                           |

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
- [ ] Stripe payment integration
- [ ] Availability rules per court/coach
- [ ] Real-time availability via Supabase Realtime
- [ ] Vercel deployment
