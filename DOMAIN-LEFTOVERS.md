# Domain configuration notes

Last reviewed: 16 October 2026.

The production application is https://fleetmaintenance.site. Production environment settings should use that canonical HTTPS origin.

The following fallback or example values still exist in code or environment templates and are not the production domain:

- .env.production.example still contains placeholder domain values. Replace them with the deployment’s actual values before using that template.
- src/lib/api.ts falls back to https://www.primeofferonline.shop when NEXT_PUBLIC_APP_URL is not set.
- src/app/api/auth/forgot-password/route.ts falls back to noreply@yourdomain.com when EMAIL_FROM is not set.
- src/components/app-footer.tsx contains the old support@fleetmanager.com address. The footer component is currently not mounted by the application layout.

These are fallbacks or unused UI text; production configuration should explicitly provide NEXT_PUBLIC_APP_URL and EMAIL_FROM. Do not expose secrets while correcting deployment values.
