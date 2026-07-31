# AAAS Points Clubhouse

## Architecture

This is a TanStack Start application deployed on Netlify. React renders the single-page member experience, TanStack server functions handle trusted business logic, and Netlify Database provides persistent Postgres storage through Drizzle ORM.

## Key Directories

- `src/routes/` contains the root document and the public clubhouse page.
- `src/server/` contains client-callable server functions for events, attendance, bonus points, and member lookup.
- `db/` contains the Drizzle schema and Netlify Database client.
- `netlify/database/migrations/` contains deploy-time database migrations and the initial event seed data.
- `public/` contains static assets.

## Data Model

- `members` stores the member profile, membership type, payment confirmation, Zeffy completion, and social handle.
- `events` stores the event calendar, point category, and fixed point value.
- `attendance` is the event point ledger and enforces one check-in per member per event.
- `bonus_points` stores social-sharing and Hip-Hop Wednesday donation awards.

## Conventions

- Use TypeScript and single quotes.
- Keep database access inside server functions or server-only modules.
- Validate every server-function input with `.inputValidator(...)`.
- Treat point values as ledger entries. Do not calculate historical points from the current event configuration.
- Use snake_case for Postgres names and camelCase for TypeScript properties.
- Keep the visual language editorial, high-contrast, and responsive. Reuse tokens in `src/styles.css`.

## Non-Obvious Decisions

- Reward boundaries are implemented as Bronze 50–99, Silver 100–149, and Gold 150+ to avoid overlapping ranges.
- The supplied dates did not include a year, so the initial calendar uses Fall 2026 dates.
- Social shares award 5 points when a handle is supplied. Fundraiser donations award 5 points per whole dollar when a receipt or payment reference is supplied.
- Close Friends access requires paid membership and completed Zeffy enrollment, plus either Premium membership or Bronze status.

## Commands

- `pnpm dev` starts the local Vite development server.
- `pnpm build` creates the production build.
- `pnpm exec drizzle-kit generate --name <imperative_name>` generates a migration after schema changes.
