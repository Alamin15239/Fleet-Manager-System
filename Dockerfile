FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
# prisma generate runs during npm's postinstall — it needs the schema here.
COPY prisma ./prisma
# Locks generated on a different OS (e.g. Windows) miss this platform's
# optional native packages (lightningcss, @swc/core, @next/swc variants).
# Regenerate the lock on THIS platform, then clean-install from it.
RUN npm install --package-lock-only --no-audit --no-fund \
 && npm ci --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Build-time only — next build validates the Prisma datasource URL at
# page-data collection. Passed in as a Docker build-arg by NexoraEdge.
ARG DATABASE_URL

RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
