# Contributing

This repository contains the Fleet Manager application operated at fleetmaintenance.site.

## Development setup

Requirements: Node.js 20+, npm, and PostgreSQL.

1. Fork or clone [Alamin15239/Fleet-Manager-System](https://github.com/Alamin15239/Fleet-Manager-System).
2. Install dependencies with npm install.
3. Copy .env.example to .env.local and configure a local PostgreSQL DATABASE_URL and strong local secrets.
4. Run npm run db:generate and npm run db:push.
5. Start with npm run dev.

Keep local secrets out of commits. Do not connect development work to the production database.

## Implementation guidance

- Follow the existing Next.js App Router and TypeScript patterns.
- Keep server-side authorization checks in place for every protected read or write. Hiding a link in the interface is not a substitute for API authorization.
- Keep UI copy compatible with the app’s English and Arabic language setting.
- Preserve the existing PostgreSQL/Prisma model conventions and validate imported workbook values on the server.
- Treat fleet, driver, job-card, account, and audit data as sensitive.
- Update the user guide or deployment documentation when behavior or configuration changes.

## Before opening a change

Review the affected flows and run the checks relevant to your change. The repository defines npm run type-check, npm run lint, and npm test. Avoid including unrelated generated files or environment values.

## Pull requests and issues

Describe the user impact, changed routes or models, deployment requirements, and verification performed. For database schema changes, include migration or rollout notes. Do not include personal data, tokens, database URLs, screenshots containing private records, or secrets in issue content.

## Security reports

Do not report security vulnerabilities in a public issue. Follow SECURITY.md.
