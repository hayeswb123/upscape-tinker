# Upscape Field Designer

Tablet-optimized landscape lighting design tool. Place fixtures on a satellite map, route wire runs, and send tiered quotes to homeowners.

## Stack
- **Next.js 16** (App Router)
- **Supabase** — auth + PostgreSQL
- **Mapbox GL JS** — satellite map
- **SendGrid** — quote emails

## Setup

### 1. Supabase
In your Supabase project, open the SQL editor and run `supabase-schema.sql`. Then grab your **anon key** from Project Settings → API.

### 2. Environment variables
Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://pufuwsmcodymmclezkig.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
NEXT_PUBLIC_MAPBOX_TOKEN=<your mapbox token>
SENDGRID_API_KEY=<your sendgrid key>
SENDGRID_FROM=notifications@getupscaped.com
```

### 3. Create users
In Supabase → Authentication → Users, create an account for each field rep.

### 4. Run locally
```bash
npm install
npm run dev
```

### 5. Deploy to Vercel
Push to GitHub, connect the repo in Vercel, add env vars in project settings, set domain to `field.getupscaped.com`.

## Pages
| Route | Description |
|-------|-------------|
| `/` | Login |
| `/dashboard` | Project list |
| `/projects/new` | New project form with address geocoding |
| `/projects/[id]/map` | Map designer |
| `/projects/[id]/quote` | 3-tier quote calculator |

## Features
- 7 fixture types: Uplight, Path, Flood, Well, Downlight, Hardscape/Step, Transformer
- 3 product tiers: Sunvie (budget), VOLT (mid), AMP (premium)
- Wire routing with auto footage calculation
- Night mode (dark map style)
- Quote emails via SendGrid
- Draggable markers
