/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output ONLY for the Docker build (NexoraEdge sets
  // DOCKER_BUILD=1 in its builder stage). Vercel builds without it.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),
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
