# Contributing to PantryIQ

## Local setup (Docker Postgres)

```bash
npm install && cp .env.sample .env
docker-compose up -d
npm run db:migrate
npm run dev
```

## Database

- Use `npm run db:migrate` for schema changes.
- Never run `db:push` in production.
- Never casually rotate `BETTER_AUTH_SECRET` (invalidates all sessions).

## Pull requests

- All PRs must pass CI (`npm run ci`).
- Target the default branch.
- Keep changes minimal and scoped.