# Organizations and separate workspaces

The original company remains connected to the existing `DATABASE_URL` and keeps its current records. A primary organization administrator can create additional organizations from **Organizations** in the app. Each new organization receives its own empty database with the app schema, company name, and first administrator. Users, vehicles, tires, job cards, invoices, reports, settings, and role permissions are isolated in that database.

## One-time deployment setup

Choose one tenant database provider. The recommended setup for the Vercel-managed Prisma Postgres storage is one Prisma project containing a separate database for each organization. The app provisions those tenant databases through Prisma's REST API; you do not need to create a new Vercel Storage resource for every organization.

### Prisma Postgres managed by Vercel

Add these server-side environment variables to Vercel → Project → Settings → Environment Variables:

| Variable | Purpose |
| --- | --- |
| `ORGANIZATION_DATABASE_PROVIDER` | Set to `PRISMA` to provision new organization databases in Prisma Postgres. |
| `PRISMA_SERVICE_TOKEN` | Secret service token with admin access to the Prisma workspace that owns the tenant project. Create it in Prisma Console → Workspace Settings → Service Tokens. |
| `PRISMA_PROJECT_ID` | ID of the Prisma project containing the Vercel-managed Prisma Postgres storage. |
| `PRISMA_DATABASE_REGION` | Optional region for tenant databases. Defaults to `inherit`, which uses the Prisma project's default region. |
| `ORGANIZATION_DATABASE_ENCRYPTION_KEY` | A stable, separate 32-byte Base64 key used to encrypt new organizations' database URLs in the primary registry. |

Keep the primary `DATABASE_URL` pointed at the existing Fleet Manager database. Do not replace it with the new Prisma storage connection string: the app uses the Prisma API to create tenant databases and stores each tenant connection encrypted in the primary registry. Each tenant uses the Prisma pooled connection for app requests and the direct connection for schema setup. Prisma project quotas and workspace permissions apply.

The service token is powerful and does not expire until revoked. Store it only as a Vercel secret; never expose it in client-side variables or chat.

### Legacy Neon provider

Set `ORGANIZATION_DATABASE_PROVIDER=NEON` and configure these instead of the Prisma variables:

| Variable | Purpose |
| --- | --- |
| `NEON_API_KEY` | Neon API key used by the server to create projects. Keep it secret. |
| `NEON_ORG_ID` | Required for a personal Neon API key when projects belong to a Neon organization. Omit it when using an organization-scoped API key. |
| `NEON_REGION_ID` | Optional Neon region, such as `aws-us-east-1`. Defaults to `aws-us-east-1`. |

Neon project limits and the selected account's permissions apply. A Vercel Marketplace-managed Neon organization can reject direct Neon project creation; in that case, use the Prisma path above or a Neon-managed organization.

Generate `ORGANIZATION_DATABASE_ENCRYPTION_KEY` in Windows PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
Write-Output $key
$rng.Dispose()
```

Save the output directly as a secret environment variable. Do not reuse `MICROSOFT_TOKEN_ENCRYPTION_KEY`, rotate this key after organizations have been provisioned, or send it in chat. Changing it without first re-encrypting the registry database URLs prevents the app from connecting to those organizations.

Deploy after adding variables. The deployment's existing `prisma db push` adds the organization registry fields to the primary database. The existing organization's records are not copied or deleted. New organizations use the provider selected by `ORGANIZATION_DATABASE_PROVIDER`; already-provisioned organizations keep their recorded provider when retried or deleted.

## Create and access an organization

1. Sign in as an administrator of the original organization.
2. Open **Organizations** in the sidebar.
3. Enter the company name, organization code, and first administrator's name and email, then choose **Create organization**.
4. Once setup succeeds, copy the login link and share it with the new administrator. The link selects that organization's database; the administrator signs in with the organization code already filled in and can use the app's email OTP login.
5. The new administrator can add their users and fleet records. Their role permissions and company settings are saved inside their own database.

If provisioning fails due to provider configuration, capacity, or a temporary connection issue, correct the deployment settings and use **Retry setup** on that organization. No database connection string is returned to the browser. Deleting a Prisma-backed organization removes only its recorded tenant database, never the shared project or the primary app database.

## Bank-transfer workspace sales

The public purchase page is `/purchase`. A primary administrator configures the receiving bank, account holder, IBAN, and optional account number under **Settings → Company → Organization Sales · Bank Transfer**. Enter monthly and/or yearly prices in SAR. Leaving a price blank disables that plan. The public page stays unavailable until an account holder, IBAN, and at least one price are configured.

Customers submit organization and administrator details, then receive a unique transfer reference and the bank details. A request does not create a database or activate access. In **Organizations → Bank-transfer requests**, verify the exact amount and reference in the bank statement before choosing **Confirm payment & create workspace**. The app then records the payment, provisions the organization's separate database using the configured provider, creates the first administrator, and emails the workspace sign-in link when email delivery is configured. If email delivery is unavailable, copy the login link shown after approval. A failed setup remains visible in Organizations and can be retried after fixing the provider configuration.

Reject requests that do not match a received bank transfer. A receipt screenshot by itself is not confirmation. Bank transfers do not renew automatically; the administrator must verify each renewal manually. The original Fleet Manager database is not changed by organization purchases.
