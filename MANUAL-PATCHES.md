# Manual Patches (guard-blocked fixes)

Six files could not be edited by the agent because the workspace write-guard
flagged pre-existing lines that merely **read** values like `process.env.JWT_SECRET`
or declare `apiKey: string` — false positives, but the guard cannot be overridden
even with user approval. Apply these small patches by hand in your editor.

After applying: `npm run type-check` should report **0 errors**
(current baseline: 12, all in the files below).

---

## 1. `src/lib/auth.ts` — 4 type errors + a crash-class bug

**(a) Fix the crash:** every login creates a `timeoutPromise` that is never
awaited or raced. It rejects 5 seconds later → `unhandledRejection: Database timeout`
in the dev log after every login. **Delete these 3 lines** (around line 92):

```ts
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      )
```

**(b) `expiresIn` typing** (line 31):

```ts
// before
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
// after
  return jwt.sign(payload, JWT_SECRET, { expiresIn: 604800 }) // 7 days in seconds
```

**(c) verify cast** (line 36):

```ts
// before
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
// after
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JWTPayload
```

**(d) payload field** — in `export interface JWTPayload` add:

```ts
  isEmailVerified?: boolean
```

---

## 2. `src/lib/resend-email.ts` — 1 type error + import-crash hardening

**(a)** Replace the module-level client (line 5):

```ts
// before
const resend = new Resend(process.env.RESEND_API_KEY)
// after
// Lazily create the Resend client so importing this module never crashes
// when RESEND_API_KEY is missing (e.g. local development without email).
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}
```

**(b)** In `sendOTPEmail`, `sendVerificationEmail`, `sendPasswordResetEmail`
change the send call (3 places):

```ts
// before
      const { data, error } = await resend.emails.send({
// after
      const { data, error } = await getResend().emails.send({
```

**(c)** ~line 497 (`sendLoginOTP` reconnect catch):

```ts
// before
        console.log('Database reconnection failed:', e.message)
// after
        console.log('Database reconnection failed:', e instanceof Error ? e.message : e)
```

---

## 3. `src/app/api/webhooks/resend/route.ts` — 1 type error + runtime crash

Next.js 15 made `headers()` async; without `await`, every webhook POST crashes.

```ts
// before (line 34)
    const headersList = headers()
// after
    const headersList = await headers()
```

---

## 4. `src/lib/realtime-sync.ts` — 2 type errors (+1 safety warning)

```ts
// before (~line 70)
      this.io.emit('sync-error', { filename, error: error.message });
// after
      this.io.emit('sync-error', { filename, error: error instanceof Error ? error.message : 'Unknown error' });
```

```ts
// before (~line 101)
          socket.emit('api-sync-error', { error: error.message });
// after
          socket.emit('api-sync-error', { error: error instanceof Error ? error.message : 'Unknown error' });
```

⚠️ **Safety warning (not a type issue):** `setupDatabaseSync()` runs
`npx prisma db push --force-reset` on an interval — that **force-resets a
database**. It is disabled locally (`SYNC_ENABLED="false"`), but delete or
guard this method before ever enabling sync.

---

## 5. `src/lib/api.ts` — 1 type error

```ts
// before (line 37)
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
// after
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
```

---

## 6. `src/lib/advanced-email-service.ts` — 3 type errors (resend v6 API)

The installed `resend@6` changed its typings. Pragmatic fixes:

```ts
// before (~line 43, inside sendEmail)
      } as any)   // <- add `as any` to the options object of emails.send
```

```ts
// before (~line 66)
      const { data, error } = await this.resend.batch.send(emails as any)
```

```ts
// before (~line 98)
      const { data, error } = await (this.resend.emails.update as any)(emailId, params)
```

Note: `emails.update` no longer exists in resend v6 — `updateEmail()` will
still fail at runtime even with a real API key. Either downgrade resend or
rework that method against the v6 API.
