# Pin & Paper Journal

A Pinterest-inspired digital bullet journal with private accounts, optional journal locks, client-side encryption, photos, stickers, drawings, paper styles and multi-page notebook spreads.

## Security model

- Supabase Auth handles email/password authentication and email verification.
- PostgreSQL Row Level Security restricts every journal, page and asset row to its owner.
- Journal content is encrypted in the browser with AES-256-GCM before upload.
- Password-derived wrapping keys use PBKDF2-HMAC-SHA-256 with 600,000 iterations and a random salt.
- Every encrypted value uses a fresh 96-bit IV.
- Recovery codes wrap the account master key separately; readable recovery codes are never stored in Supabase.
- Uploaded images will be encrypted before being written to the private Storage bucket.
- Never expose a Supabase `service_role` key in this repository or in browser code.

> This is an initial security implementation and should receive an independent security review before handling highly sensitive or regulated information.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Run `supabase/migrations/001_secure_journal.sql` in the Supabase SQL Editor.
4. In Supabase Auth URL Configuration, set the local site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
5. Start the app with `npm run dev`.

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Current milestone

- Existing journal editor migrated to a standard Next.js App Router project.
- Email/password registration and sign-in UI.
- Email confirmation callback and session refresh proxy.
- Protected `/journal` route.
- Client-side encryption, key wrapping and recovery-code primitives.
- Owner-only database schema and private encrypted asset bucket policies.

Next: connect editor save/load operations to encrypted Supabase records, encrypt photo bytes before upload, add journal lock/unlock UI, and add account recovery screens.
