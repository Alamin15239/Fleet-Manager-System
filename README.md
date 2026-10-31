<div align="center">

# Fleet Manager Pro

**Fleet operations, workshop maintenance, tire records, inventory and reporting — in one workspace.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Production](https://img.shields.io/badge/Production-fleetmaintenance.site-16a34a)](https://fleetmaintenance.site)

[Open the app](https://fleetmaintenance.site) · [User guide](docs/user-guide.md) · [Local development](docs/LOCAL-DEVELOPMENT.md)

</div>

---

## What the application manages

| Area | Main workflows |
| --- | --- |
| Fleet | Truck and trailer registers, mileage, drivers, status and vehicle history |
| Workshop | Job cards, work performed, parts used, checklists, next-service schedules and printable PDFs |
| Tires | Tire issue/out records, serials, vehicle assignment, filters and reports |
| Oil changes | Oil-change history by vehicle, date and mileage |
| Parts & consumables | Item categories, stock units, receipts, issues, returns, adjustments, current balances and reorder thresholds |
| Fleet accounts | Purchase invoices, asset costs, vendor balances and input VAT ledger |
| Compliance | Vehicle document expiry tracking, reminders and protection-card files |
| Operations | Mechanics, maintenance notifications, reports and advanced analytics |
| Integrations | OneDrive Excel sync and permission-checked Excel Changes review |
| Administration | User roles, individual permissions, organization workspaces, settings and activity monitoring |

Feature access depends on the signed-in user's role and individual permissions. Some administrative and integration features are available only to authorized administrators.

## Run the application locally

**Requirements:** Node.js 20+, npm, and a PostgreSQL database that is separate from production.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Alamin15239/Fleet-Manager-System.git
   cd Fleet-Manager-System
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Configure at least a development `DATABASE_URL` and strong local authentication secrets. Set local URLs to `http://localhost:3000`. Optional integrations such as Resend email, Microsoft OneDrive and Google sign-in can be configured later.

3. Generate Prisma Client and apply the schema to your development database:

   ```bash
   npm run db:generate
   npm run db:push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Register or sign in with an authorized development account. New accounts may require email verification and administrator approval depending on the configured authentication flow.

For environment variables, database setup, OAuth callbacks, optional integrations and troubleshooting, follow **[Local Development](docs/LOCAL-DEVELOPMENT.md)**.

> **Data safety:** Never point local development at the production database. Never commit `.env.local`, credentials, access tokens, database URLs or real customer data.

## User documentation

- **[Complete user guide](docs/user-guide.md)** — how to operate each application module.
- **[Local development setup](docs/LOCAL-DEVELOPMENT.md)** — clone, configure, run and troubleshoot the app locally.
- [Deployment guide](DEPLOYMENT.md) — production environment, database, cron and integrations.
- [OneDrive Excel sync](docs/onedrive-excel-sync.md) — Microsoft setup and workbook connection.
- [Excel workbook imports](docs/onedrive-workbook-imports.md) — review and apply workbook changes.
- [Organization workspaces](docs/organizations.md) — organization separation and workspace operations.
- [Privacy policy](docs/privacy-policy.md) · [User agreement](docs/user-agreement.md) · [Security policy](SECURITY.md).

## Technology

- Next.js App Router, React 19 and TypeScript
- Tailwind CSS and shadcn/ui
- PostgreSQL with Prisma ORM
- ExcelJS and Microsoft Graph for workbook integration
- Resend for configured email delivery
- Vercel deployment, Analytics and Speed Insights

The Prisma schema is maintained in `prisma/schema.prisma`. The production build uses `npm run vercel-build`; review [DEPLOYMENT.md](DEPLOYMENT.md) before changing production configuration.

## Operational notes

- Workbook edits are staged for review and validated against the applying user's current permissions. They are not silently applied.
- Scheduled maintenance checks are periodic, not real-time or emergency alerts.
- Document expiry email alerts depend on saved recipients, verification settings and a working Resend sender configuration.
- Spare-parts inventory has its own stock movement ledger and reorder threshold. It is separate from the maintenance alert engine.
- Public job-card share links are accessible to anyone holding the link. Share them only with intended recipients.

## Contributing and security

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions. Do not report vulnerabilities in public issues; use the private reporting instructions in [SECURITY.md](SECURITY.md).
