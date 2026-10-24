import type { MetadataRoute } from 'next'

const siteUrl = 'https://fleetmaintenance.site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/purchase`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${siteUrl}/help`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/agreement`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
