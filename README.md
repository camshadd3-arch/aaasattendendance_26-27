# AAAS Points Clubhouse

AAAS Points Clubhouse is a member attendance and rewards portal. Members can check in to organization events, receive the correct Legacy, Culture, or Soul event points, claim supported bonus opportunities, and look up their current reward status using their email address.

## Features

- Attendance form with duplicate check-in protection
- Legacy (5), Culture (10), and Soul (15) event categorization
- Social sharing bonuses and Hip-Hop Wednesday donation points
- Basic and Premium membership tracking
- Member point lookup with attendance and bonus totals
- Bronze, Silver, and Gold reward progress
- Close Friends eligibility and membership privilege messaging
- Fall 2026 event calendar seeded from the supplied AAAS schedule

## Technology

- TanStack Start and React 19
- TypeScript and Tailwind CSS
- Netlify deployment adapter
- Netlify Database managed Postgres
- Drizzle ORM and deploy-time migrations

## Local Development

Install dependencies and start the Netlify-aware development environment:

```bash
pnpm install
netlify dev --port 8889
```

The database is provisioned through Netlify Database. Schema definitions live in `db/schema.ts`, and migrations live in `netlify/database/migrations/`.

## Point Rules

- Legacy Event: 5 points
- Culture Event: 10 points
- Soul Event: 15 points
- Shared event photo or video: 5 points
- Hip-Hop Wednesday donation: 5 points per whole dollar

Reward tiers use non-overlapping thresholds: Bronze at 50–99 points, Silver at 100–149 points, and Gold at 150 or more points.
