# Personal OneDrive Excel sync

Fleet Manager exports its database to `Fleet Manager Live Data.xlsx` in the connected personal OneDrive. The app is the source of truth: the workbook is regenerated and replaced after truck, trailer, maintenance, oil-change, tire, and workshop job-card changes. Excel edits are not imported back into Fleet Manager. The OneDrive workbook REST API does not support consumer OneDrive, so this integration replaces the `.xlsx` file through Microsoft Graph's DriveItem content upload API.

## Microsoft app registration

1. In Microsoft Entra, register an app that supports **Personal Microsoft accounts only** or **Accounts in any organizational directory and personal Microsoft accounts**.
2. Add a **Web** redirect URI that exactly matches the deployed app URL plus `/api/integrations/onedrive/callback`. For example: `https://fleetmaintenance.site/api/integrations/onedrive/callback`.
3. Create a client secret and copy its value before leaving the page.
4. Add the delegated Microsoft Graph permissions `User.Read` and `Files.ReadWrite`. The owner of the personal OneDrive grants consent during connection.
5. Set these server-side environment values in the hosting provider and redeploy:
   - `MICROSOFT_CLIENT_ID`: Application (client) ID from the registration.
   - `MICROSOFT_CLIENT_SECRET`: the client secret value.
   - `MICROSOFT_TOKEN_ENCRYPTION_KEY`: a new random secret of at least 32 characters, for example the output of `openssl rand -base64 32`.
   - `NEXT_PUBLIC_APP_URL`: the canonical deployed HTTPS app URL, without a trailing path.

Do not put the secret or encryption key in a `NEXT_PUBLIC_` variable or in source control. Keep the encryption key stable: changing it invalidates the stored OneDrive refresh token, requiring the admin to reconnect.

## Connect

After deploying with the values above, sign in as an administrator, open **Settings → Excel Sync**, and choose **Connect OneDrive**. Sign into the personal Microsoft account and accept the requested access. The app creates the workbook in the OneDrive root and exposes **Sync Now**, the last sync status, and an **Open in OneDrive** link.

Disconnecting removes the saved authorization from Fleet Manager and leaves the workbook in OneDrive. Connecting again replaces the file with a fresh export.
