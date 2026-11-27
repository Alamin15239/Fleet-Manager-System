/** @type {import('next').NextConfig} */
const nextConfig = {
  // The standalone output is the build Prisma Compute ships; it is also what
  // `next start` and the Docker build run.
  output: 'standalone',
  serverExternalPackages: [
    'puppeteer-core',
    '@prisma/composer',
    '@prisma/composer-prisma-cloud',
    '@prisma/orm-postgres',
    'pg',
  ],
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    domains: ['localhost', 'vercel.app']
  },
  outputFileTracingIncludes: {
    '/api/organizations/**': ['./prisma/organization-bootstrap.sql']
  }
}

module.exports = nextConfig
