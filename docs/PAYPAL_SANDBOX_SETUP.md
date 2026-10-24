# PayPal sandbox checkout

This repository adds PayPal **sandbox** checkout for prepaid monthly or yearly Fleet Manager organization access. It does not create automatic recurring charges, and the application rejects PayPal live mode.

## Vercel environment variables

Add these server-side variables to the Vercel project and redeploy:

- `PAYPAL_CLIENT_ID` — the PayPal **Sandbox** app API key/client ID.
- `PAYPAL_CLIENT_SECRET` — the matching Sandbox secret. Keep it server-side; never use a `NEXT_PUBLIC_` prefix.
- `PAYPAL_ENVIRONMENT=sandbox` — live payments are intentionally disabled.
- `NEXT_PUBLIC_APP_URL=https://fleetmaintenance.site` — the public callback origin.
- `PAYPAL_MONTHLY_PRICE_USD=26.37` — optional monthly prepaid price.
- `PAYPAL_YEARLY_PRICE_USD=263.70` — optional yearly prepaid price.
- `NEON_API_KEY` and `ORGANIZATION_DATABASE_ENCRYPTION_KEY` — required for new workspaces to provision an isolated database after payment. `NEON_ORG_ID` and `NEON_REGION_ID` are optional, depending on your Neon account setup.

The default prices reflect the prior monthly price of SAR 99 converted for PayPal checkout, with the annual price set to ten monthly payments. PayPal checkout uses USD. Buyers can renew monthly or yearly from `/purchase`; these payments do not auto-renew.

The app checks the Neon provisioning configuration before starting a new-workspace checkout. After PayPal confirms payment, it creates the organization registry record, provisions the isolated Neon project/database, seeds the first administrator, and shows the workspace sign-in link. For a renewal, the app matches the workspace code and administrator email, then extends access without creating another database. Expired PayPal prepaid workspaces are blocked from app data until renewed.

## Sandbox checkout

Use a PayPal Sandbox buyer account to complete checkout. The success page captures the order server-side after PayPal approval. If payment capture succeeds but Neon provisioning fails, the page offers a retry and the paid purchase remains recorded for recovery.

To enable live charges later, the integration must first be deliberately updated to permit PayPal's live endpoint and then tested with approved live credentials. Do not change `PAYPAL_ENVIRONMENT` to `live` in the current code: it rejects live mode by design.