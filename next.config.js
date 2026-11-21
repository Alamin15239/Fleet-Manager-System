/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output: the Docker runner stage executes `node server.js`
  // from .next/standalone (standard Next.js Docker deployment setup).
  output: 'standalone',
  serverExternalPackages: ['puppeteer-core'],
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
