# Application analytics and telemetry

Last reviewed: 16 October 2026.

## Enabled telemetry

The root application layout loads:

- Vercel Analytics for web usage metrics.
- Vercel Speed Insights for performance metrics.
- Microsoft Clarity using a tag embedded in the client component at src/components/clarity-analytics.tsx.

The Clarity component currently identifies signed-in sessions using the application user ID and sends the user’s role, email address, and name as custom session metadata. This is personal data shared with Microsoft Clarity and must be reflected in the Company privacy notice. There is no in-app analytics opt-out control at present. Do not add further identifying attributes without a privacy review.

Activity and audit tracking also records IP address and user-agent/device information in applicable operations. The activity tracker can call ip-api.com to derive approximate location from an IP address. This is separate from Vercel Analytics and Clarity.

## Configuration and access

Vercel Analytics and Speed Insights are rendered in src/app/layout.tsx and use the deployment’s Vercel project configuration. Clarity’s tag is currently configured in src/components/clarity-analytics.tsx. Analytics dashboards are managed in the corresponding provider consoles.

## Privacy and interpretation

Telemetry metrics are not fleet source records and should not be used as operational truth. See docs/privacy-policy.md for the current account, operational data, telemetry, provider, and transfer disclosures. The app does not currently expose an in-app analytics consent or opt-out control.

## Troubleshooting

If telemetry is missing, confirm the production deployment is using the expected Vercel project and domain, then review provider dashboards and browser network errors. Do not paste telemetry secrets or private user information into a public issue.
