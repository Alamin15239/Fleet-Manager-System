// Sentry configuration for error monitoring
// Install: npm install @sentry/nextjs

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Sentry.init({
    //   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: 1.0,
    // });
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Error:', error, context);
  // Sentry.captureException(error, { extra: context });
}
