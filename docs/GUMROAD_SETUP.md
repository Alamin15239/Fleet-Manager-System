# Gumroad organization subscriptions

The public purchase page is `/purchase`. Gumroad hosts checkout and runs the monthly or yearly membership; the app provisions a separate Neon database only after it verifies a matching paid sale through the Gumroad API.

## Gumroad product setup

1. Use a recurring Membership product with monthly and yearly frequencies enabled.
2. Add these required text custom fields to the product, with these exact names:
   - `Organization Name`
   - `Workspace Code`
   - `Administrator Name`
3. Keep the membership checkout email enabled. The buyer email becomes the first administrator's login email.
4. Put the Gumroad product URL in Vercel as `NEXT_PUBLIC_GUMROAD_PRODUCT_URL`. `GUMROAD_PRODUCT_PERMALINK` should be the product's final URL segment (the current default is `ahdyo`).
5. If Gumroad offers a post-purchase redirect setting for this membership, set it to `https://fleetmaintenance.site/purchase/success`.

The purchase page prefills the fields and buyer email using Gumroad's documented checkout URL parameters. Gumroad checkout remains the source of truth for the amount and frequency.

## Server configuration

Set these Vercel Production environment variables:

- `GUMROAD_ACCESS_TOKEN`: a server-side Gumroad API access token with sales read permission. Never use a `NEXT_PUBLIC_` name for this value or paste it into chat.
- `GUMROAD_PRODUCT_PERMALINK`: the permalink for the membership product.
- `NEXT_PUBLIC_GUMROAD_PRODUCT_URL`: the full public membership checkout URL.
- `GUMROAD_ALLOW_TEST_SALES`: optional; set to `true` only in an isolated test deployment if Gumroad returns test sales through the API. Keep `false` or unset in production.

Organization provisioning also requires the existing Neon configuration: `NEON_API_KEY`, `NEON_REGION_ID` (optional), `NEON_ORG_ID` (optional), and `ORGANIZATION_DATABASE_ENCRYPTION_KEY`, along with the app's existing `DATABASE_URL` and `JWT_SECRET`.

## Gumroad Ping

In Gumroad's Ping settings, set the endpoint to:

`https://fleetmaintenance.site/api/webhooks/gumroad`

The endpoint accepts Gumroad's form-encoded POST, uses only its sale ID as a lookup key, and fetches the sale from Gumroad's API before trusting any buyer, product, status, or price data. A test ping with no sale ID is acknowledged without provisioning. Gumroad-marked test sales are ignored unless `GUMROAD_ALLOW_TEST_SALES=true`; leave this off in production. Refunds, disputes, failed renewals, and cancellations update the organization's billing status; canceled memberships retain access only through their current paid period.

## What happens after checkout

1. The buyer enters organization details at `/purchase` and completes the recurring membership checkout on Gumroad.
2. Gumroad sends a Ping. The app verifies the sale, product, membership frequency, buyer email, and custom fields.
3. The app records the sale idempotently, provisions a new Neon project/database, applies the tenant schema, and creates the first administrator.
4. The organization signs in using the workspace code at `/login?org=<workspace-code>` and uses email OTP to access the account.

If the Ping arrives before Vercel has the token or Neon provisioning variables, Gumroad can retry after the variables are fixed. The sale ID is used for deduplication, and failed workspace provisioning can be retried by a repeated Ping.

## Manual setup still required

- Add the token and product URL variables in Vercel and redeploy.
- Configure Gumroad's three custom field labels and Ping URL.
- Confirm organization provisioning capacity and Neon API permissions.
- Use Gumroad's no-charge self-test to inspect checkout. Test sales are ignored by default and may not be available from the sales API.
- To test full database provisioning, use an isolated test deployment and enable `GUMROAD_ALLOW_TEST_SALES=true` only if Gumroad exposes that test sale through the API. Do not use your own credit card to buy your own product; Gumroad warns that can trigger account suspension.
