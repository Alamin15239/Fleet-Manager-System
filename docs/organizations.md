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
