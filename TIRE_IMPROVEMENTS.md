# Tire Management: current behavior

Last reviewed: 16 October 2026.

## What the page supports

The tire-management page records tire issue/out entries and provides operational filters, detail views, analytics, and reports. Depending on the form, a record can include tire size, positive Out Qty, truck or trailer, driver, serial number, manufacturer/origin, date, and notes.

Vehicle and trailer association is chosen while entering a tire record; the tire page is not the fleet register.

## How quantities are counted

Tire analytics and tire reports count recorded positive Out Qty values. A zero or blank quantity does not increase the total. Tire issue history should preserve the source value and should not be changed just to force an expected summary. Validate the workbook/source and the entry form when a total does not match.

Serial-tracked counts are a separate metric and are not interchangeable with total out quantity. Tire categories and manufacturer/origin values must use the supported values in the form and server validation.

## Workbook use

Tires are included in the connected Excel workbook. Workbook edits are staged in Excel Changes, validated, and applied only by a user whose current role permits the action. Conflicts must be reviewed. Worksheet row deletion never deletes a tire record in the app.

## Support

For a mismatch, provide the tire size, source row/date, recorded Out Qty, and a private record reference to the administrator. Do not include a user’s personal data in a public issue.
