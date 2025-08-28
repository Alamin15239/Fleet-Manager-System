/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['prisma', '@prisma/client'],
  images: {
    domains: ['localhost'],
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  }
}

module.exports = nextConfig