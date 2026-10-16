# Security Policy

Fleet Manager is a business application for authorized fleet and workshop staff. Security issues should be reported privately to the Company administrator or saad@saadfreeh.com. Do not include passwords, access tokens, database URLs, or secret values in a report.

## Supported release

The supported production application is the deployment at https://fleetmaintenance.site. This repository’s main branch is the source for the current code; deployments may lag behind a commit.

## Current security controls

The codebase includes authenticated API routes, role and per-user permission checks, input validation in selected routes, Prisma database access, activity/audit records, password hashing, and server-side encryption for the stored OneDrive refresh token. Security controls vary by route and integration; this list is not a certification or a claim that every possible vulnerability has been eliminated.

## Reporting details

Please include the affected page or API route, the steps to reproduce, the impact, and a safe way to contact you. Avoid accessing, changing, or exporting other users’ or Company data while investigating. The administrator will review the report and coordinate any remediation.
