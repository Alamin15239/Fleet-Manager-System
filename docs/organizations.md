# Organizations and separate workspaces

The original company remains connected to the existing `DATABASE_URL` and keeps its current records. A primary organization administrator can create additional organizations from **Organizations** in the app. Each new organization receives a separate Neon project and an empty database with the app schema, company name, and its first administrator. Users, vehicles, tires, job cards, invoices, reports, settings, and role permissions are isolated in that organization's database.

## One-time deployment setup

Add these server-side environment variables to the app deployment (for example, Vercel → Project → Settings → Environment Variables):

| Variable | Purpose |
| --- | --- |
| `NEON_API_KEY` | Neon API key used by the server to create projects. Keep it secret. |
| `NEON_ORG_ID` | Required for a personal Neon API key when projects belong to a Neon organization. Omit it when using an organization-scoped API key. |
| `NEON_REGION_ID` | Optional Neon region, such as `aws-us-east-1`. Defaults to `aws-us-east-1`. |
| `ORGANIZATION_DATABASE_ENCRYPTION_KEY` | A stable, separate 32-byte Base64 key used to encrypt new organizations' database URLs in the primary registry. |

Create the Neon API key in Neon Console → Account/Organization settings → API keys. A personal API key must have access to the Neon organization selected by `NEON_ORG_ID`. Neon project limits and the selected account's permissions apply.

**Important:** The Neon organization must be managed directly by Neon. A Vercel Marketplace-managed Neon organization rejects the direct Neon API project-creation call with `organization is managed by Vercel`. Use a separate Neon-managed organization and its API key; do not replace the primary app's `DATABASE_URL`. After updating `NEON_API_KEY` and, for a personal key, `NEON_ORG_ID` in Vercel Production, redeploy and choose **Retry setup** for organizations marked **FAILED**. Their confirmed transfer requests remain approved; retrying setup does not ask the customer to pay again.

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

Deploy after adding variables. The deployment's existing `prisma db push` adds the organization registry fields to the primary database. The existing organization's records are not copied or deleted.

## Create and access an organization

1. Sign in as an administrator of the original organization.
2. Open **Organizations** in the sidebar.
3. Enter the company name, organization code, and first administrator's name and email, then choose **Create organization**.
4. Once setup succeeds, copy the login link and share it with the new administrator. The link selects that organization's database; the administrator signs in with the organization code already filled in and can use the app's email OTP login.
5. The new administrator can add their users and fleet records. Their role permissions and company settings are saved inside their own database.

If provisioning fails due to Neon configuration, capacity, or a temporary connection issue, correct the deployment settings and use **Retry setup** on that organization. No database connection string is returned to the browser.

## Bank-transfer workspace sales

The public purchase page is `/purchase`. A primary administrator configures the receiving bank, account holder, IBAN, and optional account number under **Settings → Company → Organization Sales · Bank Transfer**. Enter monthly and/or yearly prices in SAR. Leaving a price blank disables that plan. The public page stays unavailable until an account holder, IBAN, and at least one price are configured.

Customers submit organization and administrator details, then receive a unique transfer reference and the bank details. A request does not create a database or activate access. In **Organizations → Bank-transfer requests**, verify the exact amount and reference in the bank statement before choosing **Confirm payment & create workspace**. The app then records the payment, provisions the organization's separate Neon database, creates the first administrator, and emails the workspace sign-in link when email delivery is configured. If email delivery is unavailable, copy the login link shown after approval. A failed Neon setup remains visible in Organizations and can be retried after fixing the Neon configuration.

Reject requests that do not match a received bank transfer. A receipt screenshot by itself is not confirmation. Bank transfers do not renew automatically; the administrator must verify each renewal manually. The original Fleet Manager database is not changed by organization purchases.
