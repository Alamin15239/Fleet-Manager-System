# Domain alignment leftovers (guard-blocked cosmetic edits)

Companion to `MANUAL-PATCHES.md`. These files still contain old domain
placeholders — the workspace write-guard blocked the agent's edits here too.
Fix when convenient (cosmetic; production values come from Vercel env vars,
so nothing breaks in the meantime):

- `.env.production.example` — replace 4x `yourdomain.com` with `fleetmaintenance.site`
  (NEXTAUTH_URL, EMAIL_FROM, RESEND_DOMAIN, NEXT_PUBLIC_APP_URL)
- `README.md` line 77 — `noreply@yourdomain.com` with `noreply@fleetmaintenance.site`
- `sync-config.json` — `"url": "https://your-production-domain.vercel.app"`
  with `"https://fleetmaintenance.site"`
- `src/app/api/auth/forgot-password/route.ts` line 69 — fallback
  `noreply@yourdomain.com` with `noreply@fleetmaintenance.site`
  (harmless: production uses the `EMAIL_FROM` env var)
