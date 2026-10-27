# OneDrive for Business Excel sync

The app connects a Microsoft work or school account and maintains Fleet Manager Live Data.xlsx in OneDrive for Business or SharePoint. App records are the authoritative operational data; app changes refresh the workbook when the integration is connected. Excel changes flow into a review queue and are applied only after a permitted user reviews them.

## Microsoft app registration

1. Create a Microsoft Entra app registration for organizational (work or school) accounts. The OAuth authorize and token endpoints use the `organizations` tenant.
2. Add a Web redirect URI matching the deployed origin plus /api/integrations/onedrive/callback. Production uses https://fleetmaintenance.site/api/integrations/onedrive/callback.
3. Create a client secret and copy the value securely.
4. Add delegated Microsoft Graph permissions User.Read and Files.ReadWrite.
5. Set these server-side production variables and redeploy:
   - MICROSOFT_CLIENT_ID: Application (client) ID.
   - MICROSOFT_CLIENT_SECRET: secret value.
   - MICROSOFT_TOKEN_ENCRYPTION_KEY: stable random key of at least 32 characters.
   - NEXT_PUBLIC_APP_URL: canonical HTTPS app origin.
   - CRON_SECRET: required by scheduled workbook change watcher.

Do not put credentials in a NEXT_PUBLIC_ variable or commit them. Keep the token-encryption key stable. Rotating it makes the existing encrypted refresh token unreadable and requires an administrator to reconnect OneDrive.

## Connect and sync

1. Sign in with an administrator account.
2. Open Settings → Excel Sync and select Connect OneDrive.
3. Sign in to the personal Microsoft account and grant the requested access.
4. Confirm the workbook name, Open in OneDrive link, last successful update, and review-queue count.
5. Use Sync Now to request a manual workbook refresh.

The workbook includes Trucks, Trailers, Maintenance, Oil Changes, Tires, Job Cards, and Vehicle Documents. The Vehicle Documents sheet includes document title/type, linked asset and driver, issue date, expiration date, reminder start date, notes, file name, last-updated time, and a hidden stable record ID. Newly added document records are included on the next workbook sync. App edits and additions are sent to the workbook after the relevant application save operation.

## Disconnect

Disconnecting removes the saved authorization from Fleet Manager; it does not delete the workbook from OneDrive. Reconnecting retains the OneDrive file target when available and refreshes the data through the integration.
