# Nexora OCI Staging Deployment

This document describes the staging deployment boundary for Fleet Manager on Nexora.
It does not authorize production activation or database migration.

## Application shape

- Next.js 15 application with a custom Node.js HTTP server in `server.ts`.
- Socket.IO is attached to the same HTTP server at `/api/socketio`; the Nexora ingress must support WebSocket upgrades.
- Prisma datasource is PostgreSQL.
- Puppeteer requires system Chromium; the OCI image installs Chromium and points Puppeteer at it.
- The container listens on `HOST=0.0.0.0` and `PORT=3000` by default; Nexora may inject a different port.
- `/api/health` is the container health-check endpoint. It is a process health probe, not a database readiness check.

## Required runtime configuration

Inject these only through the Nexora runtime secret/configuration mechanism:

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Staging-only PostgreSQL connection string with TLS where supported |
| `JWT_SECRET` | Unique high-entropy secret; never reuse another environment's value |
| `NEXTAUTH_SECRET` | Unique high-entropy secret; never reuse another environment's value |
| `NEXTAUTH_URL` | Exact HTTPS staging origin |
| `NEXT_PUBLIC_APP_URL` | Exact HTTPS staging origin |
| `PORT` | Nexora-assigned container port, normally `3000` |
| `HOST` | `0.0.0.0` |

Optional integrations must remain disabled unless their credentials and callback URLs are configured and tested: Resend/SMTP, Microsoft OneDrive, OpenAI, scheduled jobs, and any legacy Vercel integration. Do not add optional credentials to the image or build workflow.

## Database safety

- Use a new, isolated staging PostgreSQL database. Never point staging at the existing production database.
- The repository has SQL/schema setup scripts and does not currently provide a conventional checked-in Prisma migration history suitable for blind `prisma migrate deploy`.
- Review the schema and all data-changing scripts before initializing a database.
- Do not run `prisma db push`, seed, reset, or production setup scripts against an existing database without an approved backup and explicit migration plan.
- Bootstrap an initial administrator only with `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (minimum 16 characters) supplied through a protected one-time operator environment. Never bake these into the image.

## Image and execution boundary

- GitHub Actions builds the OCI image and publishes an immutable commit-SHA tag to GHCR.
- The image must be referenced by its SHA-256 digest, not the mutable `staging` tag.
- The GHCR package is private unless an operator explicitly changes its visibility. Runtime image-pull credentials must be stored in the node's protected secret store.
- Customer application code must run only in an approved rootless OCI runtime node with resource limits, isolated networking, restricted egress, private per-workload storage, and owner-only runtime secrets.
- Never run the customer image in the Cloudflare Worker, monitoring agent, privileged provisioner, or the VM used for Nexora development.
- Do not create a live hostname route or enable workload execution until node enrollment, image pull, secret delivery, ingress, health gating, rollback, and isolation acceptance tests have passed.

## Staging acceptance checklist

- [ ] OCI image build succeeds and GHCR digest is recorded.
- [ ] Isolated rootless runtime node is enrolled and reports healthy.
- [ ] Runtime can pull the pinned image digest using protected registry credentials.
- [ ] Fresh staging PostgreSQL database is provisioned and schema initialization is reviewed.
- [ ] Required secrets are injected at runtime, never at build time.
- [ ] HTTP health probe succeeds and database readiness is independently verified.
- [ ] Socket.IO WebSocket upgrade works through Nexora ingress.
- [ ] Egress policy, CPU/memory/PID/disk limits, persistent volume isolation, and secret-file permissions pass tests.
- [ ] Rollback to a prior immutable digest is tested.
- [ ] Only then may a staging hostname be routed to the workload.

Production promotion requires a separate review and explicit approval.
