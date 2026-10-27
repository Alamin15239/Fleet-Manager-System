# Role-checked Excel workbook imports

Workbook edits can flow back to Fleet Manager through the Excel Changes review queue. They are staged first; the app does not blindly trust workbook rows.

## Deployment setup

Use the OneDrive for Business app registration in docs/onedrive-excel-sync.md. Production also requires CRON_SECRET for the scheduled /api/cron/onedrive-import-watch route. Set NEXT_PUBLIC_APP_URL to the deployed HTTPS origin and redeploy.

The production build updates the Prisma schema. An administrator should open Settings → Excel Sync after deployment and use Sync Now to ensure the workbook contains current hidden row identifiers and matching baselines. The watcher receives Microsoft Graph change notifications and has a daily scan to recover missed notifications.

## User workflow

1. Edit an existing row or add a row in Trucks, Trailers, Maintenance, Oil Changes, Tires, or Job Cards in the connected workbook.
2. The app receives a OneDrive notification or a scheduled scan finds the edit. An authorized user can also open Excel Changes and select Check workbook now.
3. Review the complete row, changed fields, current app values, validation result, and conflict details.
4. Apply one eligible change or use the bulk apply action for eligible pending changes. The server checks the applying user’s current role and permissions and validates each row.
5. Resolve eligible app-versus-workbook conflicts separately after reviewing the complete row. Invalid values and permission-denied rows cannot be bulk-applied.
6. Once pending edits are resolved, Fleet Manager republishes current app records to refresh the workbook baseline.

Deleting a worksheet row does not delete an app record. Conflicts and pending workbook edits prevent silent replacement of the workbook. If the app update is queued or fails, review Settings → Excel Sync and retry Sync Now.
