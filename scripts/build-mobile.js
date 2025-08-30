const fs = require('fs')
const path = require('path')

// Create a simple mobile build script
console.log('🔧 Building for mobile deployment...')

// Remove API routes for static export
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api')
if (fs.existsSync(apiDir)) {
  console.log('📱 Mobile build: API routes will be handled by server')
}

// Create mobile-specific configuration
const mobileConfig = {
  name: 'Fleet Manager',
  short_name: 'FleetManager',
  description: 'Fleet and Tire Management System',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#000000',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png'
    }
  ]
}

// Write manifest for PWA
fs.writeFileSync(
  path.join(__dirname, '..', 'public', 'manifest.json'),
  JSON.stringify(mobileConfig, null, 2)
)

console.log('✅ Mobile build configuration complete')