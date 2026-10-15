# Role-checked Excel workbook imports

The OneDrive workbook now supports inbound edits through a review queue. Each exported row carries hidden IDs and a hidden last-synced baseline so app-side edits are not mistaken for workbook edits. The app watches the connected personal OneDrive, compares visible row values with that baseline, and stages changed or new rows. It never imports worksheet row deletions.

## Deployment setup

The existing Microsoft app registration and delegated `Files.ReadWrite` permission are used. The Vercel deployment also needs a random `CRON_SECRET` environment variable in Production so the daily `/api/cron/onedrive-import-watch` job can renew the Microsoft Graph subscription. After setting it, redeploy. The app's existing `NEXT_PUBLIC_APP_URL` must be the public HTTPS origin.

The Vercel build runs `prisma db push`, which creates the new review queue table and OneDrive notification columns. Open **Settings → Excel Sync** once as an admin after deployment; this creates or renews the OneDrive folder subscription. Click **Sync Now** once to initialize an existing workbook with hidden row IDs and baselines. This first sync establishes the app's current records as the starting point; after that, workbook edits are imported for role-checked review. The daily job renews the subscription and scans for missed file notifications.

## User workflow

1. Edit a row or add a row in one of the workbook tabs: Trucks, Trailers, Maintenance, Oil Changes, Tires, or Job Cards.
2. OneDrive notifies the app. A user can also select **Excel Changes → Check workbook now** to request a scan.
3. The app shows the changed fields or new row on **Excel Changes**.
4. The signed-in user's current role and per-user permissions are checked by the server when **Apply change** is selected. The data is validated before it is saved and audited with the applying user.
5. Once all pending changes are applied or dismissed, the app republishes the workbook with refreshed hidden record IDs and row baselines for reliable future matching.

If the same app record changed after the workbook edit was detected, the row is marked as a conflict. An admin can dismiss it after resolving the difference. Pending and conflicted changes prevent the app from overwriting the edited workbook. Deleting a row in Excel never deletes an app record.
