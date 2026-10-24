# Stripe organization billing setup

Fleet Manager's organization checkout uses Stripe-hosted Checkout for monthly or yearly subscriptions. A signed webhook confirms payment before the app provisions the organization's isolated Neon database. The buyer's administrator is created in that new workspace; payment card details stay with Stripe. Configure exactly one Stripe mode per deployment: test or live.

## 1. Create sandbox prices

In Stripe Dashboard, switch to **test mode** and create a product such as **Fleet Manager**. Add one active recurring price billed monthly and another active recurring price billed yearly. For end-to-end testing, you can use **SAR 1.00 per month** and **SAR 1.00 per year**. Copy their Price IDs (`price_...`) into `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_YEARLY_PRICE_ID` respectively.

The checkout page offers each configured interval and reads its amount and currency from Stripe. The server rejects inactive, one-time, metered, or wrong-interval prices. You may configure only one interval; the other option will be unavailable. `STRIPE_PRICE_ID` remains supported as a legacy alias for the yearly price.

## 2. Configure a test webhook

Create a Stripe webhook destination for:

```text
https://fleetmaintenance.site/api/webhooks/stripe
```

Subscribe it to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the destination's signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`. Webhook event handling is signature-verified and idempotent. Failed processing returns an error so Stripe retries it.

## 3. Configure Vercel for test mode

For a sandbox test on the production domain, add these server-side environment variables to **Production**. If you test on a Preview deployment, configure Preview separately and set `NEXT_PUBLIC_APP_URL` to that deployment's public URL.

| Variable | Value |
| --- | --- |
| `STRIPE_MODE` | `test` |
| `STRIPE_SECRET_KEY` | Stripe sandbox secret key (`sk_test_...`) or a restricted test key (`rk_test_...`) limited to Price read, subscription read, Checkout Session write, and Billing Portal Session write |
| `STRIPE_WEBHOOK_SECRET` | Sandbox endpoint signing secret (`whsec_...`) |
| `STRIPE_MONTHLY_PRICE_ID` | Monthly sandbox Price ID (`price_...`) |
| `STRIPE_YEARLY_PRICE_ID` | Yearly sandbox Price ID (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | `https://fleetmaintenance.site` |

Keep these credentials server-side. Never use a publishable key in place of `STRIPE_SECRET_KEY`, and never commit keys to Git. Redeploy after adding or changing environment variables.

Organization database provisioning also requires the existing server-side Neon configuration: `NEON_API_KEY`, `ORGANIZATION_DATABASE_ENCRYPTION_KEY`, and optionally `NEON_ORG_ID` / `NEON_REGION_ID`.

## 4. Test the flow

Open `/purchase`, submit a new organization and administrator, and complete Stripe's sandbox Checkout with a test payment method from Stripe's test documentation. The success page waits for the signed webhook and database setup, then links to the new workspace sign-in. Check Stripe's webhook delivery log and Vercel function logs if setup remains pending.

Sign in as the workspace administrator and open **Subscription & billing** to verify the selected interval and open Stripe's Customer Portal. Configure the Customer Portal in Stripe Dashboard to permit payment-method updates and cancellation. If customers should be able to switch between monthly and yearly plans after checkout, enable subscription updates for both prices in the portal configuration. Configure Stripe's subscription recovery / Smart Retries settings there as appropriate. The app keeps access through a seven-day failed-payment grace period; after it expires or a subscription is canceled, only the workspace administrator's billing and sign-in recovery endpoints remain available.

## Switch Production to live billing

Only switch after a successful end-to-end test and after Stripe has enabled live payments for your account. Test and live products, prices, customers, subscriptions, and webhook destinations are separate in Stripe. A test subscription does not become a live subscription.

1. In Stripe **Live mode**, create and activate the monthly and yearly Prices. Copy their live `price_...` IDs.
2. In Stripe **Live mode**, create a separate webhook destination at `https://fleetmaintenance.site/api/webhooks/stripe`. Choose **Snapshot** payloads and the same eight events listed above. Copy its live `whsec_...` signing secret.
3. In Vercel **Production** environment variables, replace the test values with `STRIPE_MODE=live`, a live secret key beginning `sk_live_` (or a restricted `rk_live_` key with the required permissions), both live Price IDs, and the live webhook signing secret. Keep Preview configured for test mode if Preview is used for development.
4. Configure the Stripe Customer Portal in Live mode to allow payment-method updates and cancellation. Review subscription recovery settings and any tax or merchant obligations for the countries where you plan to sell.
5. Redeploy Production and confirm a new live checkout displays the intended currency, amount, and selected monthly or yearly interval before accepting customers.

The application rejects a Stripe secret key whose `sk_` / `rk_` mode prefix does not match `STRIPE_MODE`; the webhook also rejects events whose `livemode` flag does not match the deployment setting.
