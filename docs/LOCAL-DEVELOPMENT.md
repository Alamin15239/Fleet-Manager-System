# Local Development Guide

This guide explains how to install, configure, run and troubleshoot Fleet Manager Pro on your own computer.

## 1. Prerequisites

Install the following before starting:

- **Node.js 20 or newer** (use the LTS release).
- **npm**, included with Node.js.
- **PostgreSQL** 14 or newer, running locally or in a separate development database.
- **Git**.
- A code editor such as Visual Studio Code.

Check your versions:

```bash
node --version
npm --version
git --version
```

## 2. Clone the repository

```bash
git clone https://github.com/Alamin15239/Fleet-Manager-System.git
cd Fleet-Manager-System
npm install
```

Use the `main` branch for the current application source. Do not edit generated build output or files under `node_modules`.

## 3. Create a development database

Create a dedicated PostgreSQL database, for example `fleet_manager_dev`, and a database user with permission to create and modify tables in that database.

Example using PostgreSQL command-line tools:

```sql
CREATE USER fleet_dev WITH PASSWORD 'replace-with-a-strong-local-password';
CREATE DATABASE fleet_manager_dev OWNER fleet_dev;
```

Use the connection string supplied by your local PostgreSQL setup. A typical local URL looks like:

```text
postgresql://fleet_dev:YOUR_LOCAL_PASSWORD@localhost:5432/fleet_manager_dev
```

Do not use the production database URL for local work.

## 4. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

At minimum, configure:

| Variable | Local purpose |
| --- | --- |
| `DATABASE_URL` | Your development PostgreSQL connection string |
| `JWT_SECRET` | Long, random local signing secret |
| `NEXTAUTH_URL` | `http://localhost:3000` where required by the auth flow |
| `NEXTAUTH_SECRET` | Random local secret for NextAuth-related configuration |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local links and callbacks |

Generate local secrets rather than reusing production values. Keep `.env.local` private; it must never be committed.

### Optional integrations

Configure these only when you intend to test the corresponding feature:

- **Email:** `RESEND_API_KEY`, `EMAIL_FROM` and any sender-domain settings used by the deployment.
- **Microsoft OneDrive:** Microsoft Entra client ID/secret, callback configuration and `MICROSOFT_TOKEN_ENCRYPTION_KEY`.
- **Google sign-in:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with the local callback registered in the OAuth client.
- **Scheduled tasks:** `CRON_SECRET` for protected cron endpoints. Local scheduled jobs are not automatically created by running the development server.

Refer to `.env.example` and [DEPLOYMENT.md](../DEPLOYMENT.md) for the full variable names and production-specific notes. Never put a secret in a `NEXT_PUBLIC_` variable.

## 5. Generate Prisma Client and prepare the schema

Run:

```bash
npm run db:generate
npm run db:push
```

This generates the Prisma Client and applies the current Prisma schema to the database configured in `DATABASE_URL`.

If the schema changes later, review the change and rerun the appropriate Prisma command against your development database. Do not run database reset commands against production.

## 6. Start Fleet Manager

```bash
npm run dev
```

Open:

- App: [http://localhost:3000](http://localhost:3000)
- Sign in: [http://localhost:3000/login](http://localhost:3000/login)
- Help: [http://localhost:3000/help](http://localhost:3000/help)

The development server watches the application source and restarts when relevant files change. Stop it with `Ctrl+C`.

## 7. First-time application setup

1. Register a development account or use an authorized test account.
2. Complete email verification if the configured authentication flow requires it.
3. Have an administrator approve the account if approval is enabled.
4. Confirm that the account is in the intended organization/workspace.
5. Review role and individual permissions before testing protected modules.
6. Add test trucks, trailers, mechanics and sample workshop records only to the development database.

A new user is not automatically an administrator. Do not bypass authorization checks to make local testing easier.

## 8. Test optional integrations

### Email

Add the local Resend configuration and a valid sender identity. Confirm recipients and sender-domain verification in Resend. Use test recipients; do not send test messages to real employees without authorization.

### OneDrive Excel

Register a Microsoft Entra application with the local callback URL used by the current integration. Add the credentials to `.env.local`, restart the server and connect from Settings → Excel Sync. Use a test workbook and test Microsoft account. Workbook edits should be reviewed through Excel Changes before they update application records.

### Google sign-in

Register the local OAuth callback:

```text
http://localhost:3000/api/auth/google/callback
```

Set the client ID and secret in `.env.local`, then restart the server.

## 9. Useful development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development server |
| `npm run build` | Generate Prisma Client and build Next.js |
| `npm run type-check` | Run TypeScript checks |
| `npm test` | Run Jest tests |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Apply Prisma schema to the configured development database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:backup` | Run the repository's database backup script (check its target and credentials first) |

Run checks relevant to your change before committing. A successful local build does not guarantee production integrations or deployment settings are correct.

## 10. Troubleshooting

**Database connection fails**
- Confirm PostgreSQL is running.
- Check database name, username, password, host and port in `DATABASE_URL`.
- Confirm the local database user has the required privileges.

**Prisma Client or schema errors**
- Run `npm run db:generate`.
- Confirm `DATABASE_URL` points to the development database.
- Review Prisma errors before applying schema changes.

**Port 3000 is already in use**
- Stop the other development server, or follow the port shown in the terminal and use that local URL.

**Sign-in or verification does not work**
- Check the authentication secrets and local app URL.
- If email verification is enabled, configure the email provider and inspect server logs.
- Ask an administrator to approve the test account if required.

**OneDrive, Google or email integration fails**
- Verify the exact local callback URL and provider credentials.
- Restart the dev server after changing environment variables.
- Check provider-side app registration, sender verification and server logs. Never paste secrets into an issue.

## 11. Safe development checklist

- Use a dedicated development database.
- Use synthetic test data, not real driver or customer records.
- Keep secrets in `.env.local` and provider secret stores.
- Preserve server-side role and permission checks.
- Test both English and Arabic layouts when changing UI.
- Check mobile layouts for forms, tables and dialogs.
- Update [the user guide](user-guide.md) when a user workflow changes.
- Never deploy experimental changes to production without reviewing the diff and deployment configuration.
