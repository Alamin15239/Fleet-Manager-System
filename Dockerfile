# Debian slim (glibc) — native packages (lightningcss, @swc/core, @next/swc)
# resolve reliably here; Alpine (musl) variants are often missing from lock
# files generated on other OSes and crash next/font at build time.
FROM node:20-slim AS base

# Prisma engines require OpenSSL, which slim images don't include.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json ./
# prisma generate runs during npm's postinstall — it needs the schema here.
COPY prisma ./prisma
# Real npm install (not npm ci / not --package-lock-only): resolves and
# installs the native packages for THIS platform, immune to the npm bug
# where lockfiles generated elsewhere miss platform variants.
RUN npm install --no-audit --no-fund

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
