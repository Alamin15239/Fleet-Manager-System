# Fleet Manager User Guide

Last updated: 20 October 2026
Production app: https://fleetmaintenance.site
In-app guide: https://fleetmaintenance.site/help

This guide covers the current user-facing modules. A page or action appears only when the signed-in account has the required access. Contact the Company administrator to request permissions.

## Sign in and navigate

Open /login and sign in with the registered account. A new account may require email verification and administrator approval. Use the password reset flow if needed. Never share your password or one-time code.

Use the sidebar to navigate. On a phone, open the menu button. Use the language toggle for English or Arabic and the appearance control for the theme. Help, Privacy Policy, and User Agreement are available from the profile menu; links are also on sign-in and sign-up screens.

## Dashboard

The Dashboard summarizes fleet records, maintenance, and activity available to your account. Use the cards and links to open the lists behind the summary. Counts reflect the records currently stored in the app and your accessible data.

## Trucks

Use Trucks to find and manage truck records. Depending on your permissions, you can add, edit, or remove trucks. Records include items such as truck number/plate, VIN, make, model, year, current mileage, driver, status, inspection and oil-change dates, and related service history.

Update the record when driver or mileage changes. Accurate current values feed dashboards, maintenance checks, and workbook exports. Review linked records before retiring or editing an asset.

## Trailers

Use Trailers to manage trailer number, status, driver, inspection information, and maintenance history. Select the correct trailer when creating a workshop job card or recording related work.

## Document Expiry Tracker and Protection Cards

Use Document Expiry Tracker for each truck’s fire extinguisher, operation card, Istimara, insurance, driver card, and Fahas records. Enter an expiry date; the reminder starts automatically 10 days earlier. Fire extinguisher records need no uploaded file. Upload a file for the other five document types. The tracker shows missing, current, reminder-started, and expired entries. Each truck can have one current file per document type; uploading the same type again replaces that file.

For a truck or trailer’s Protection Card, open the vehicle’s details from its existing page and use the Protection Card section. Each vehicle has its own private file, with no expiry dates or reminders. Uploading again replaces that vehicle’s current Protection Card file. Job cards remain the maintenance records and drive maintenance tracking.

## Tire Management

Tire Management stores tire issue/out records. Available fields include tire size, Out Qty, truck or trailer, driver, serial number, manufacturer/origin, date, and notes.

- Add a tire record from the tire-entry form and select the vehicle/trailer association there.
- Search and filter by the table’s available fields.
- Tire analytics and reports count positive Out Qty values. Blank or zero quantities do not increase the total.
- Serial-tracked count is not the same as total Out Qty.
- Check source rows, units, dates, and supported manufacturer/origin values before applying workbook changes.

## Workshop Job Cards

Workshop Job Cards is the workshop work-order system for trucks and trailers. The older Maintenance route redirects to this page. Create a card and enter the asset, service date and type, reported issue, priority, odometer when relevant, driver and technician, work performed, spare parts, checklist, notes, and next-service date or odometer.

After saving, use the card’s preview, download, or print controls. The job-card document is formatted as a single-page A4 portrait form. A share link lets anyone who has that link view the card without signing in. Share the link only with the intended recipient because it may display vehicle, driver, technician, work, notes, and signature details.

## Oil Changes

Use Oil Changes to record and review oil-change events. Choose the truck and enter the actual date, mileage, driver, and oil details available in the form. Correct dates and odometers are important for useful reports and maintenance history.

## Purchase Invoices and Fleet Accounts

Use Purchase Invoices & Accounts to record vendor bills for maintenance, spare parts, tires, batteries, oil and filters, and other fleet costs. Create the vendor first if it is not already in the vendor list. Enter the vendor's invoice number and dates, then add each invoice line and assign it to the truck or trailer that incurred the cost. The asset picker can be searched by fleet number.

Choose whether the bill is a VAT invoice. For VAT invoices, set the invoice VAT rate (15% is the starting value) and whether entered unit prices include VAT. The app separates the net expense, input VAT, and vendor payable in its ledger. A no-VAT bill records the full line amount as the asset expense and does not post input VAT. Review the total before posting.

The Truck & Trailer Accounts tab shows costs by assigned asset; Vendor Accounts shows invoice balances owed to vendors; Input VAT shows the recoverable VAT ledger. These are ledger views of posted bills, not payment or bank reconciliation screens. Posted bills cannot be edited in place: use Void to reverse their journal entry while preserving the audit trail, then enter the corrected bill.

## Mechanics

Mechanics is the technician directory. Authorized users can add or update mechanics and their contact/specialty details. Select the relevant mechanic or technician when recording work.

## Reports

Choose the report type, date range, and filters. If the report allows vehicle selections, select one truck/trailer/tire to report that item, or select several to include each selection. Review the matching-record count and preview before downloading.

If there are no matching records, clear filters, widen the dates, or verify that source records exist. Reports describe stored data and do not repair missing or inaccurate records.

## Advanced Analytics

Advanced Analytics displays aggregated trends from the records available in the app. Use it to explore overall fleet and maintenance patterns, then inspect the relevant underlying records before acting.

## Notifications

The header bell shows recent in-app notifications and refreshes while the application is open. The Notifications page displays the broader history, supports refresh and unread filtering, and lets you mark items read.

Maintenance notifications are checked by a scheduled production task once daily, targeting 04:00 UTC (07:00 in Riyadh). Hosting may run it within a time window. Checks use maintenance due dates and intervals, trailer inspection/maintenance, and job-card next service dates or mileage; this is not a real-time or emergency warning.

Email notifications require the email option and a configured mail provider. Automated maintenance alert emails go to active, approved administrators. Low-stock alerts are unavailable because parts inventory quantities are not stored in this app.

## OneDrive Excel Sync

An administrator connects a personal Microsoft OneDrive account in Settings → Excel Sync. The workbook includes Trucks, Trailers, Maintenance, Oil Changes, Tires, and Job Cards. App changes refresh the workbook when connected; use Sync Now for a manual refresh.

## Excel Changes review

Workbook edits and additions are detected and staged under Excel Changes; they do not silently change app records.

1. Select Check workbook now, or wait for the watcher/scan.
2. Review the complete row, changed fields, validation message, and current app values.
3. Apply one eligible change or use bulk apply for the eligible pending changes.
4. The server checks the acting user’s current role and permissions for each applied row.
5. Conflicts, invalid values, and rows outside your permissions require review. A deleted worksheet row does not delete an app record.

Check Settings → Excel Sync for workbook link, last successful update, and connection or watcher errors.

## Profile and users

Profile displays your account information and allows available profile edits, including a profile photo. User Management is permission-controlled and used by authorized administrators/managers to add, update, approve, reactivate, or set permissions for accounts. Administrators can set role permissions and individual user overrides.

If a user should no longer have access, ask an administrator to deactivate the account. Assign only the permissions required for the user’s job.

## Settings and Admin

Settings can include company details used on reports and job cards, currency, timezone, maintenance intervals, notification preferences, system options, Excel Sync, role permissions, and activity. Some tabs require administrator access.

Admin pages include administrative activity and monitoring views. Backup files and exported activity logs may contain sensitive business and personal information.

## Common fixes

- **A page is missing:** ask the administrator to check your role and user-specific permissions.
- **Workbook not current:** check the connected workbook and last successful update, then retry Sync Now.
- **Workbook change not applied:** read validation/conflict details and confirm the acting user has the required permission.
- **Email notification missing:** ask an administrator to verify notification settings, sender configuration, and mail logs.
- **Incorrect report:** review the date range, filters, selected assets, and source record values.

For support, contact the Company administrator or alaminkhan.xiaomi@gmail.com. Do not send passwords, tokens, or secret keys.
