import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fleet Manager System',
    short_name: 'Fleet Manager',
    description: 'Comprehensive fleet and tire management system',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#f5faff',
    theme_color: '#0b1f3a',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/fleet-manager-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
