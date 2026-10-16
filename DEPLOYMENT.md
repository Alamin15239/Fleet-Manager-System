# Deployment Guide

The production application is hosted at [fleetmaintenance.site](https://fleetmaintenance.site). This repository uses Next.js 15, Prisma, and PostgreSQL. The current Vercel build command is npm run vercel-build; it pushes the Prisma schema, generates the client, and builds Next.js.

## Required production configuration

Set secrets in the hosting provider, never in source control:

| Variable | Use |
| --- | --- |
| DATABASE_URL | PostgreSQL connection URL |
| JWT_SECRET | Application token signing; use a long random secret |
| NEXTAUTH_URL | Canonical app URL where required by auth configuration |
| NEXTAUTH_SECRET | NextAuth-related configuration |
| NEXT_PUBLIC_APP_URL | Canonical HTTPS origin used for links and OAuth callbacks |

Optional services:

| Variables | Use |
| --- | --- |
| RESEND_API_KEY, EMAIL_FROM, RESEND_DOMAIN | Email delivery |
| CRON_SECRET | Authorizes scheduled API routes; required for notification cron and workbook import watcher |
| MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET | Microsoft Entra app registration for OneDrive |
| MICROSOFT_TOKEN_ENCRYPTION_KEY | Stable server-side key used to encrypt the stored OneDrive refresh token |

Changing MICROSOFT_TOKEN_ENCRYPTION_KEY makes the saved OneDrive refresh token unreadable; an administrator must reconnect the account. Register the production callback as https://fleetmaintenance.site/api/integrations/onedrive/callback (change the origin if the deployment URL changes). Never expose Microsoft secrets in a NEXT_PUBLIC_ variable.

## Database and build

The Prisma datasource is PostgreSQL. For local schema updates, configure a development PostgreSQL URL, then run:

    npm run db:generate
    npm run db:push

The Vercel build command runs prisma db push. Review schema changes and ensure the production database URL is correctly scoped before deploying.

## Vercel scheduled tasks

vercel.json configures two daily jobs:

| Route | UTC schedule | Purpose |
| --- | --- | --- |
| /api/cron/onedrive-import-watch | 03:00 | Renew/check the OneDrive workbook change watcher and scan for missed workbook changes |
| /api/cron/notifications | 04:00 | Run maintenance notification checks |

Both routes require Authorization: Bearer <CRON_SECRET>. The notification schedule targets 07:00 in Riyadh. Hosting plans can execute a scheduled job within a time window, so this should not be treated as an exact-time or real-time alert.

## OneDrive setup

Connect OneDrive from Settings → Excel Sync after the Microsoft app registration and environment variables are set. See [Personal OneDrive Excel sync](docs/onedrive-excel-sync.md) for the delegated scopes, redirect URI, and user workflow. Workbook changes are staged for review and checked against the applying user’s permissions; see [Workbook imports](docs/onedrive-workbook-imports.md).

## Email setup

Configure the sender and Resend credentials in the deployment environment. Notification settings must enable email for email delivery. The test-notification control sends a test to the signed-in account. Automated maintenance alert emails are sent to active, approved administrators. Delivery depends on valid provider configuration.

## Production checklist

- Confirm all environment variables and production scopes.
- Confirm DATABASE_URL points to the intended PostgreSQL database.
- Confirm the Vercel domain and Microsoft redirect URI match.
- Set a strong CRON_SECRET and redeploy.
- Confirm email and OneDrive integrations from Settings.
- Confirm the production build and scheduled jobs in Vercel deployment logs.
- Maintain a separate backup and restore process appropriate for the Company’s records.

Do not print secret values in support requests or logs.
