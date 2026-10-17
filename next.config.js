/** @type {import('next').NextConfig} */
const nextConfig = {
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
