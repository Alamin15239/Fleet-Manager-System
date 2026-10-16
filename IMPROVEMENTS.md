# Current application status and known limitations

Last reviewed: 16 October 2026. This file replaces the earlier aspirational improvement checklist; it describes the current system rather than promising roadmap work.

## Current system

Fleet Manager provides role-aware truck and trailer management, workshop job cards, tire issue/out records, oil-change history, a mechanic directory, maintenance reports and analytics, account/profile/settings pages, notification history, admin monitoring, and optional OneDrive Excel synchronization with a role-checked workbook review queue.

The interface includes English and Arabic language settings and responsive layouts. Report and job-card output is generated from application data and the configured company details.

## Known limits to account for

- Spare-parts quantities are not stored; low-stock notifications are disabled.
- Scheduled maintenance checks run daily, not continuously. They should not be used as emergency alerts.
- Workbook edits are staged for review. They are not automatically trusted or applied; conflicts and invalid values require review.
- Deleting a row from Excel does not delete an application record.
- A shared job-card link is accessible to anyone who possesses it.
- Analytics and activity services include third-party telemetry and IP-derived approximate location; see docs/privacy-policy.md.
- Accuracy of reports and alerts depends on current source records and user permissions.

## Change process

For a new improvement, open an issue or pull request that states the user workflow and expected behavior. Include role/permission effects, mobile and Arabic behavior, data validation, reporting, and deployment impact where applicable. Keep this file updated when a limitation is fixed or behavior changes.
