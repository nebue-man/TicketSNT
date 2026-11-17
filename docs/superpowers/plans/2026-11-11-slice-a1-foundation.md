# Slice A1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js + TypeScript + Tailwind + Supabase project structure for the SNT ticket platform, including the full DB schema migration and typed Supabase client, so every subsequent slice can build on a clean foundation.

**Architecture:** Next.js 15 App Router with TypeScript strict mode; a manually authored `Database` type drives the Supabase client generics so all subsequent queries are fully typed without code-gen. Supabase migrations live in `supabase/migrations/` and are applied by hand against the Supabase project dashboard (no Supabase CLI required for this slice). No middleware, no auth, no pages beyond a placeholder root — those belong to later slices.

**Tech Stack:** Next.js 15 · TypeScript 5 · Tailwind CSS · `@supabase/supabase-js` · `@supabase/ssr` · Resend (placeholder only in A1)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/types/database.ts` | TypeScript interfaces for every DB table + `Database` generic |
| Create | `src/lib/supabase/client.ts` | Browser Supabase client |
| Create | `src/lib/supabase/server.ts` | Server-component Supabase client (uses `cookies()`) |
| Create | `supabase/migrations/0001_initial_schema.sql` | Full DDL: all tables, enums, constraints |
| Create | `.env.example` | All required env vars with placeholder values |
| Modify | `next.config.ts` | Remove static export; keep standard SSR config |
| Modify | `src/app/globals.css` | Minimal Tailwind directives only |
| Modify | `src/app/page.tsx` | Placeholder root page (no active buyer route here) |
| Modify | `src/app/layout.tsx` | Root layout with Inter font |

---

## Task 1: Initialise the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` (all via create-next-app)

- [ ] **Step 1: Run create-next-app inside the repo root**

```bash
cd /Users/dilshan/Documents/TicketsSNT
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias \
  --turbopack
```

When prompted "Ok to proceed?" answer `y`. When asked about import alias, say `No` (keep `@/` default from `--src-dir`).

Expected output ends with: `Success! Created ... at .`

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, no errors in the terminal. Stop with `Ctrl-C`.

- [ ] **Step 3: Commit the scaffold**

```bash
git add -A
git commit -m "init: scaffold Next.js 15 + TypeScript + Tailwind"
```

---

## Task 2: Harden tsconfig and next.config.ts

**Files:**
- Modify: `tsconfig.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Replace `tsconfig.json` with strict config**

Replace the full content of `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Replace `next.config.ts` with minimal SSR config**

Replace the full content of `next.config.ts` with:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
```

Note: no `output: 'export'` — this app uses API routes and server components which require SSR.

- [ ] **Step 3: Run lint + build to confirm baseline**

```bash
npm run lint && npm run build
```

Expected: lint passes, build succeeds, output in `.next/`.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json next.config.ts
git commit -m "config: strict TypeScript, standard SSR next config"
```

---

## Task 3: Install Supabase dependencies

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected: packages added under `dependencies` in `package.json`.

- [ ] **Step 2: Verify install didn't break the build**

```bash
npm run build
```

Expected: build still succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @supabase/supabase-js and @supabase/ssr"
```

---

## Task 4: Write TypeScript database types

**Files:**
- Create: `src/types/database.ts`

- [ ] **Step 1: Create the file**

Create `src/types/database.ts` with the following content:

```typescript
export type EventStatus = 'draft' | 'published' | 'closed' | 'archived'
export type ReservationStatus = 'active' | 'void'

export interface Event {
  id: string
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  status: EventStatus
  gate_pin: string
  max_per_reservation: number
  created_at: string
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  price: number
  capacity: number
  sold: number
  sort_order: number
}

export interface Reservation {
  id: string
  event_id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  status: ReservationStatus
  created_at: string
}

export interface ReservationItem {
  id: string
  reservation_id: string
  ticket_type_id: string
  quantity: number
}

export interface ScanLog {
  id: string
  reservation_id: string
  scanned_at: string
  confirmed: boolean
}

export interface Settings {
  id: number
  notification_email: string
}

export type Database = {
  public: {
    Tables: {
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Event, 'id'>>
      }
      ticket_types: {
        Row: TicketType
        Insert: Omit<TicketType, 'id' | 'sold'> & { id?: string; sold?: number }
        Update: Partial<Omit<TicketType, 'id'>>
      }
      reservations: {
        Row: Reservation
        Insert: Omit<Reservation, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Reservation, 'id'>>
      }
      reservation_items: {
        Row: ReservationItem
        Insert: Omit<ReservationItem, 'id'> & { id?: string }
        Update: Partial<Omit<ReservationItem, 'id'>>
      }
      scan_logs: {
        Row: ScanLog
        Insert: Omit<ScanLog, 'id' | 'scanned_at'> & { id?: string; scanned_at?: string }
        Update: Partial<Omit<ScanLog, 'id'>>
      }
      settings: {
        Row: Settings
        Insert: Settings
        Update: Partial<Settings>
      }
    }
    Enums: {
      event_status: EventStatus
      reservation_status: ReservationStatus
    }
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "types: add Database type for all tables and enums"
```

---

## Task 5: Create Supabase clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create the browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create the server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat: add browser and server Supabase clients"
```

---

## Task 6: Write the database migration

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create the directory and migration file**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE event_status AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE reservation_status AS ENUM ('active', 'void');

-- events
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  date_time       timestamptz NOT NULL,
  venue           text        NOT NULL,
  description     text        NOT NULL,
  cover_image_url text,
  status          event_status NOT NULL DEFAULT 'draft',
  gate_pin        text        NOT NULL,
  max_per_reservation int     NOT NULL DEFAULT 10,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ticket_types
CREATE TABLE ticket_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       text    NOT NULL,
  price      numeric NOT NULL,
  capacity   int     NOT NULL,
  sold       int     NOT NULL DEFAULT 0,
  sort_order int     NOT NULL DEFAULT 0
);

-- reservations  (id is RES-XXXXXX format, set by application)
CREATE TABLE reservations (
  id          text PRIMARY KEY,
  event_id    uuid    NOT NULL REFERENCES events(id),
  buyer_name  text    NOT NULL,
  buyer_email text    NOT NULL,
  buyer_phone text    NOT NULL,
  status      reservation_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- reservation_items
CREATE TABLE reservation_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  text NOT NULL REFERENCES reservations(id),
  ticket_type_id  uuid NOT NULL REFERENCES ticket_types(id),
  quantity        int  NOT NULL
);

-- scan_logs
CREATE TABLE scan_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text        NOT NULL REFERENCES reservations(id),
  scanned_at     timestamptz NOT NULL DEFAULT now(),
  confirmed      boolean     NOT NULL DEFAULT false
);

-- settings (single row, notification email for admin alerts)
CREATE TABLE settings (
  id                 int  PRIMARY KEY DEFAULT 1,
  notification_email text NOT NULL DEFAULT '',
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id, notification_email) VALUES (1, '')
  ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX idx_reservations_event_id ON reservations(event_id);
CREATE INDEX idx_reservation_items_reservation_id ON reservation_items(reservation_id);
CREATE INDEX idx_scan_logs_reservation_id ON scan_logs(reservation_id);
```

- [ ] **Step 2: Run the migration in Supabase**

Go to your Supabase project → SQL Editor → paste the full migration → Run.

Expected: "Success. No rows returned." (or similar success message, no errors).

- [ ] **Step 3: Verify tables exist in Supabase Table Editor**

In Supabase Table Editor, confirm these tables are visible:
`events`, `ticket_types`, `reservations`, `reservation_items`, `scan_logs`, `settings`

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/0001_initial_schema.sql
git commit -m "db: add initial schema migration (all 6 tables)"
```

---

## Task 7: Create .env.example and wire env vars

**Files:**
- Create: `.env.example`
- Create: `.env.local` (local only, never committed)

- [ ] **Step 1: Create `.env.example`**

Create `.env.example`:

```bash
# Supabase — get these from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend — get from resend.com/api-keys
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=tickets@sntentertainments.com

# Admin login (bcrypt hash of your chosen password)
# Generate: node -e "const b=require('bcryptjs');b.hash('yourpassword',10).then(console.log)"
ADMIN_PASSWORD_HASH=

# App URL (no trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Verify `.env.example` is committed and `.env.local` is in `.gitignore`**

```bash
grep -n '\.env\.local' .gitignore
```

Expected: a line like `.env*.local` or `.env.local` is present (create-next-app adds this by default).

- [ ] **Step 3: Create your local `.env.local` from your Supabase project**

Copy `.env.example` to `.env.local` and fill in real values from:
- Supabase dashboard → Project Settings → API → Project URL and anon/public key
- Leave `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_PASSWORD_HASH` blank for now — they're not used in A1.

```bash
cp .env.example .env.local
# edit .env.local with your real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

- [ ] **Step 4: Commit `.env.example`**

```bash
git add .env.example
git commit -m "config: add .env.example with all required variables"
```

---

## Task 8: Clean up default boilerplate and add placeholder root page

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/globals.css` with minimal Tailwind directives**

Replace the full content of `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

Replace the full content of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SNT Ticket Platform',
  description: 'Ticket reservation for SNT Entertainment events',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with a placeholder root page**

Replace the full content of `src/app/page.tsx` with:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">SNT Ticket Platform</h1>
        <p className="mt-2 text-gray-500">Access via your event link.</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Delete create-next-app default assets**

```bash
rm -f public/next.svg public/vercel.svg src/app/favicon.ico
```

(If `favicon.ico` doesn't exist at that path, skip that one — it may be under `app/`.)

- [ ] **Step 5: Commit cleanup**

```bash
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx public/
git commit -m "chore: remove create-next-app boilerplate, add placeholder root page"
```

---

## Task 9: Final verification

**Files:** (no new files)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no errors, no warnings about `any` or unused imports.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: build succeeds, `Next.js` outputs build info, no type errors, no lint errors.

- [ ] **Step 4: Smoke-test in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: page renders "SNT Ticket Platform / Access via your event link." in the browser. No console errors.

- [ ] **Step 5: Tag the slice complete**

```bash
git tag a1-foundation
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Next.js App Router + TypeScript | Task 1 |
| Supabase (Postgres) | Tasks 3, 5, 6 |
| `events` table with all fields | Task 6 |
| `ticket_types` with capacity + sold | Task 6 |
| `reservations` with RES-XXXXXX id | Task 6 |
| `reservation_items` | Task 6 |
| `scan_logs` with confirmed flag | Task 6 |
| `settings` table (notification email) | Task 6 |
| TypeScript types for all tables | Task 4 |
| `.env.example` with all vars | Task 7 |
| `gate_pin` stored (hashed later in C1) | Task 6 |
| Resend placeholder | `.env.example` |
| Admin password placeholder | `.env.example` |
