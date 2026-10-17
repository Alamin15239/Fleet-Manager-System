# Fleet Manager System

Fleet Manager is the web application used by Saadfreeh Transport Est. to manage fleet records, workshop job cards, tire issue records, oil changes, maintenance alerts, reports, and a OneDrive Excel workbook.

Production application: [fleetmaintenance.site](https://fleetmaintenance.site)
Source repository: [Alamin15239/Fleet-Manager-System](https://github.com/Alamin15239/Fleet-Manager-System)
User-facing help: [In-app guide](/help)
Last reviewed: 16 October 2026

## Current functions

- **Dashboard** — operational summaries and links to the underlying records.
- **Trucks and trailers** — fleet register, vehicle details, mileage, driver, status, inspections, and related service history.
- **Workshop Job Cards** — work orders for trucks and trailers, checklist, work and parts, signatures, print/PDF and share-link flow. The old Maintenance page redirects to Job Cards.
- **Tire Management** — tire issue/out records and filters for available tire, vehicle, driver, serial, and date details. Tire totals use positive Out Qty values.
- **Oil Changes and Mechanics** — separate oil-change history and technician directory.
- **Reports and Advanced Analytics** — filtered maintenance reports, PDF/Excel exports where provided by the page, and aggregated operational charts.
- **Notifications** — daily scheduled maintenance checks, in-app notification history, and optional email delivery.
- **Excel Changes and OneDrive Sync** — app records can refresh the connected workbook. Workbook edits are staged for permission-checked review before being applied to the app.
- **Users, Profile, Settings, and Admin** — account and permission management, company settings, activity, and system monitoring according to access rights.
- **Help, Privacy Policy, and User Agreement** — available from the profile menu and authentication pages.

Feature visibility and write actions are controlled by the account role and user-specific permissions. Administrators should grant only the access required for a person's work.

## Run locally

Requirements: Node.js 20 or newer, npm, and a PostgreSQL database.

1. Clone the repository:
   ```
   git clone https://github.com/Alamin15239/Fleet-Manager-System.git
   cd Fleet-Manager-System
   npm install
   ```
2. Copy .env.example to .env.local and configure at least DATABASE_URL and a strong JWT_SECRET. Configure NEXTAUTH_URL, NEXTAUTH_SECRET, and NEXT_PUBLIC_APP_URL for the local origin. Configure email and Microsoft integration only if you need those features.
3. Generate the Prisma client and sync the local schema:
   ```
   npm run db:generate
   npm run db:push
   ```
4. Start the development server:
   ```
   npm run dev
   ```
5. Open http://localhost:3000. Account registration may require email verification and administrator approval.

Do not use a production database for local development or commit any environment file containing secrets.

## Stack and data

- Next.js 15 App Router and React 19
- TypeScript, Tailwind CSS, and shadcn/ui components
- PostgreSQL with Prisma
- ExcelJS for workbook generation and processing
- Microsoft Graph for the optional personal OneDrive workbook integration
- Resend for email when configured
- Vercel deployment, Analytics, and Speed Insights; Microsoft Clarity is also enabled

The Prisma schema is in prisma/schema.prisma. The app stores accounts, fleet and maintenance records, tire records, job cards, settings, notifications, and audit/activity data in PostgreSQL.

## Operational notes

- The OneDrive connection and deployment requirements are documented in [docs/onedrive-excel-sync.md](docs/onedrive-excel-sync.md) and [docs/onedrive-workbook-imports.md](docs/onedrive-workbook-imports.md).
- Multiple organizations with isolated Neon databases are documented in [docs/organizations.md](docs/organizations.md).
- Notification checks run daily from the Vercel cron configuration. They target 04:00 UTC / 07:00 Riyadh time, subject to the deployment scheduler.
- Spare-parts quantities are not stored, so low-stock alerts are unavailable.
- The application currently sends signed-in user ID, role, email, and name to its Microsoft Clarity integration. See [Privacy Policy](docs/privacy-policy.md) and ANALYTICS.md.
- A public job-card share link can be viewed by anyone holding that link. Share it only with the intended recipient.
- See DEPLOYMENT.md for production configuration and SECURITY.md for vulnerability reporting.

## Documentation

- [User Guide](docs/user-guide.md)
- [Privacy Policy](docs/privacy-policy.md)
- [User Agreement](docs/user-agreement.md)
- [Deployment](DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
