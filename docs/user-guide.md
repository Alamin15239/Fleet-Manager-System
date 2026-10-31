# Fleet Manager Pro — Complete User Guide

This guide explains how to use the modules available in Fleet Manager Pro. The exact pages and actions shown to you depend on your role and individual permissions.

**Production app:** https://fleetmaintenance.site  
**In-app help:** https://fleetmaintenance.site/help  
**Language:** English and Arabic are available from the language control.

## 1. Sign in and navigate

Sign in with your approved account. New accounts may require email verification and administrator approval. Use the password reset flow if you cannot sign in; never share your password, one-time code or passkey.

Use the sidebar to open modules. On mobile, open the navigation menu. Use the language and theme controls to adjust the interface. If a page is missing, ask an administrator to review your role and individual permissions.

## 2. Dashboard

The dashboard summarizes fleet records, maintenance activity and operational information available to your account. Use dashboard cards and links to open the underlying lists. Counts reflect saved records and your accessible data; review the source records before making operational decisions.

## 3. Trucks

Open **Trucks** to search and manage the truck register. Depending on your permissions, you can add, view, edit or deactivate/remove records. Keep the plate/fleet number, VIN, make, model, year, mileage, assigned driver, status and other available details accurate.

Update mileage and driver assignments when they change. These values support reporting, maintenance checks and workbook exports. Review linked service and job-card history before changing a vehicle record.

## 4. Trailers

Use **Trailers** to manage trailer identifiers, status, driver, inspection details and maintenance history. Select the correct trailer when recording a workshop job or other trailer-related activity.

## 5. Document expiry tracker and protection cards

Use **Document Expiry** to track required vehicle records such as Fire Extinguisher, Operation Card, Istimara, Insurance, Driver Card and Fahas. Enter the correct expiry date and upload the required file for the document types that request one. Fire Extinguisher can be tracked without an uploaded file. The tracker distinguishes current, reminder-started, expired and missing records.

For the truck/trailer **Protection Card**, open the vehicle details and use its Protection Card area. The protection-card file is separate from the expiry tracker and does not create an expiry reminder. Replacing a document replaces the current file for that document slot; verify the vehicle and document type before uploading.

Document expiry email alerts use the saved notification recipients and verified email setting. A new document with an expiry date, a changed expiry date, or a replacement upload can trigger an event email. Daily expiry summaries are a separate scheduled process. Delivery depends on the configured Resend sender and valid recipients. Contact an administrator if an expected email is missing.

## 6. Workshop job cards

**Workshop Job Cards** is the work-order module for trucks and trailers. Create a card for the correct asset and enter the service date/type, reported problem, priority, odometer where relevant, driver, technician, work performed, parts used, checklist, notes and next-service date or mileage.

Save the card, then use its preview, print or download controls. Job-card output is formatted for A4 printing. A share link provides read-only access to anyone who has the link; share it only with the intended recipient because it can reveal vehicle, driver, technician, work and signature details.

## 7. Tire management

Use **Tire Management** to record tire issue/out activity. Available fields include tire size, quantity, truck/trailer association, driver, serial number, manufacturer/origin, date and notes.

- Add records through the tire-entry form and select the correct vehicle or trailer.
- Search and filter using the fields shown on the page.
- Reports and analytics count positive Out Qty values; zero or blank quantities do not increase the total.
- Serial-tracked counts and total Out Qty are different measures.
- Review source values and units before saving or applying workbook changes.

## 8. Oil changes

Use **Oil Changes** to record oil-change events separately from general workshop cards. Select the truck and enter the actual service date, mileage, driver and oil details available in the form. Correct dates and odometers are essential for reliable service history and reports.

## 9. Spare parts and consumables inventory

Open **Spare Parts & Consumables** to manage workshop stock, including engine oil, oil filters, diesel filters, air filters, fuel filters and general parts.

### Create a stock item
Enter the item name, optional part number, category, unit, optional oil grade and reorder level. Available categories include General, Engine Oil, Oil Filter, Diesel Filter, Air Filter, Air Dryer Filter, Water Separator Filter, Fuel Filter and Other. Available units are **pcs, litre, kg, set and box**. Choose the unit that matches how the stock is physically counted. Quantity and reorder level use the same unit.

### Record stock movements
Choose the item and transaction type, then enter quantity and date. The available movements include:
- **Opening stock** — starting balance when setting up the item.
- **Purchase / stock in** — goods received into the store.
- **Issue to vehicle** — stock used for a truck or trailer; enter the vehicle details and job-card/reference information where available.
- **Customer return / Supplier return** — record returned goods using the correct direction.
- **Stock adjustment (+/-)** — record a verified correction to the stock balance.

Add references and notes so another user can understand why the movement was recorded.

### Review and correct stock
The **Current stock** tab shows each item, category/grade, available balance, unit, reorder level and status. **Edit stock** sets the balance to a verified physical count and records the difference as a stock adjustment. **Edit reorder** changes the threshold that marks the item for reorder. The **Transaction history** tab is the audit trail for stock movements.

A low/reorder status means the balance is at or below the configured reorder level. This stock indicator is separate from scheduled maintenance notifications.

## 10. Mechanics

Use **Mechanics** as the technician directory. Authorized users can add or update technician details and specialties. Select the correct mechanic/technician when recording workshop work.

## 11. Purchase invoices and fleet accounts

Use **Purchase Invoices & Accounts** to record supplier bills for maintenance, parts, tires, batteries, oil, filters and other fleet expenses. Select or create the vendor, enter invoice number and dates, add invoice lines, and assign each cost to the truck or trailer that incurred it.

For a VAT invoice, use the VAT rate on the supplier document (15% is the default starting value) and indicate whether entered prices include VAT. No-VAT bills do not post input VAT. Review the invoice totals and asset allocation before posting.

Use **Truck & Trailer Accounts** for costs by asset, **Vendor Accounts** for amounts owed to suppliers and **Input VAT** for the input VAT ledger. These are accounting ledger views, not bank or payment reconciliation. Posted invoices are locked; authorized users can void an incorrect invoice to reverse its journal entry while retaining the audit trail, then enter the corrected bill.

## 12. Reports

Choose the report type, date range and available filters. Select one or more assets when the report supports multi-selection. Review the matching-record count and preview before downloading PDF, Excel or other available output.

If the report is empty, widen the date range, clear restrictive filters and confirm the source records exist. Reports reflect stored data; they do not repair inaccurate entries.

## 13. Advanced analytics

Use **Advanced Analytics** to explore aggregated fleet, maintenance and operational trends. Treat charts as a summary; inspect the underlying records before making maintenance, purchasing or staffing decisions.

## 14. Notifications and email alerts

The header bell shows recent in-app notifications. Open **Notifications** for the history, refresh the list, filter unread items and mark items as read.

Scheduled maintenance checks run periodically (currently daily in production) and may include due/overdue maintenance, mileage intervals, trailer inspection/maintenance and job-card next-service schedules. They are not real-time or emergency warnings.

Email alerts depend on the notification settings, valid recipients and configured email sender. Document upload/replacement and expiry-date changes can trigger document event emails when the feature is enabled. Daily summaries are separate. Low-stock status is shown in inventory; do not assume it sends maintenance email alerts.

## 15. OneDrive Excel Sync

An administrator connects the authorized Microsoft OneDrive account from **Settings → Excel Sync**. The connected workbook can contain truck, trailer, maintenance, oil-change, tire and job-card data. App-side changes can refresh the workbook; use **Sync Now** when a manual refresh is needed.

Check the workbook link and last successful update in Settings. If the workbook is disconnected or stale, ask an administrator to check the Microsoft connection and watcher status.

## 16. Excel Changes review

Workbook edits and additions are staged for review; they are not silently applied to app records.

1. Open **Excel Changes** and check the connected workbook.
2. Review each changed row, changed fields, validation result and current app values.
3. Apply an eligible change individually or use bulk apply for eligible rows.
4. The server validates the data and checks the acting user's current role and permissions.
5. Resolve conflicts and invalid values before retrying. Deleting a worksheet row does not delete the corresponding app record.

## 17. Profile, users and permissions

**Profile** contains your account details and available profile updates. **User Management** is restricted to authorized users and can support account creation, approval, activation/deactivation, role assignment and individual permission overrides.

Grant only the access required for each person's work. Hiding a menu item is not a substitute for server-side access control; all protected operations must be performed through the authorized account.

## 18. Organization workspaces

The application supports separate organization workspaces and organization-specific data boundaries. Always confirm that you are signed into the correct company/workspace before creating, importing or editing records.

Workspace creation, database provisioning and purchase-request administration are restricted to the primary administrator. A bank-transfer request does not activate a workspace; provisioning begins only after the administrator confirms receipt of the transfer. Do not move records between organizations unless explicitly authorized.

## 19. Settings and administration

Depending on your permissions, **Settings** can include company details used on job cards and reports, currency, timezone, maintenance intervals, notification recipients, email test controls, Excel Sync, role permissions and system preferences.

Administrative pages may include organization management, activity logs, user monitoring, storage/database information and system health. Treat exports, backups and logs as sensitive business information. Do not share them publicly.

## 20. Common troubleshooting

| Problem | What to check |
| --- | --- |
| A page or action is missing | Confirm the correct account, organization, role and individual permissions. |
| Stock quantity looks wrong | Check the item unit and transaction history; reconcile only against a verified physical count. |
| A document email did not arrive | Check saved To/CC/BCC recipients, verified status, sender configuration and email provider logs with an administrator. |
| OneDrive workbook is stale | Check the connection and last successful update, then use Sync Now or ask an administrator to reconnect. |
| Excel edit was not applied | Review validation/conflict details and confirm the applying user has permission. |
| A report is empty or incorrect | Check date range, filters, selected assets and source-record values. |
| Login or account approval fails | Use password reset and contact an administrator about verification or approval status. |

For support, contact your company administrator. Do not send passwords, OTPs, access tokens, database URLs or secret keys.
