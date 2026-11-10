# Nexora OCI image for Fleet Manager's custom Next.js + Socket.IO server.
# The app's server.ts owns the HTTP listener and Socket.IO path; do not use
# Next's generated standalone server.js because that bypasses Socket.IO setup.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates chromium fonts-liberation libasound2 libatk-bridge2.0-0 \
      libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 \
      libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
      libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxrandr2 libxrender1 libxshmfence1 libxss1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# tsx is currently declared in devDependencies and is required to run server.ts.
COPY package.json package-lock.json ./
RUN npm install --include=dev --ignore-scripts --no-audit --no-fund

COPY . .

# Safe build-only placeholders. Production secrets and DATABASE_URL are injected
# by the runtime secret manager and are never embedded as real credentials.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    NEXTAUTH_SECRET="nexora-build-placeholder-not-a-runtime-secret" \
    NEXTAUTH_URL="https://staging.invalid" \
    npx prisma generate && \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    NEXTAUTH_SECRET="nexora-build-placeholder-not-a-runtime-secret" \
    NEXTAUTH_URL="https://staging.invalid" \
    npm run build

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "server.ts"]
