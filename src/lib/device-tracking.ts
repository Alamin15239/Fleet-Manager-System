import { NextRequest } from 'next/server'

export interface DeviceInfo {
  deviceName?: string
  deviceType?: string
  browser?: string
  os?: string
  userAgent?: string
}

export interface LocationInfo {
  country?: string
  city?: string
  region?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

export interface TrackingInfo {
  ipAddress?: string
  device: DeviceInfo
  location?: LocationInfo
}

export function parseUserAgent(userAgent: string): DeviceInfo {
  const device: DeviceInfo = {
    userAgent,
    deviceType: 'Unknown',
    browser: 'Unknown',
    os: 'Unknown'
  }

  // Detect device type
  if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    device.deviceType = 'Mobile'
  } else if (/Tablet|iPad/i.test(userAgent)) {
    device.deviceType = 'Tablet'
  } else {
    device.deviceType = 'Desktop'
  }

  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    device.browser = 'Chrome'
  } else if (userAgent.includes('Firefox')) {
    device.browser = 'Firefox'
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    device.browser = 'Safari'
  } else if (userAgent.includes('Edg')) {
    device.browser = 'Edge'
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    device.browser = 'Opera'
  }

  // Detect OS
  if (userAgent.includes('Windows NT')) {
    device.os = 'Windows'
    const version = userAgent.match(/Windows NT ([\d.]+)/)?.[1]
    if (version) {
      const windowsVersions: { [key: string]: string } = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7'
      }
      device.os = `Windows ${windowsVersions[version] || version}`
    }
  } else if (userAgent.includes('Mac OS X')) {
    device.os = 'macOS'
    const version = userAgent.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.')
    if (version) device.os = `macOS ${version}`
  } else if (userAgent.includes('Linux')) {
    device.os = 'Linux'
  } else if (userAgent.includes('Android')) {
    device.os = 'Android'
    const version = userAgent.match(/Android ([\d.]+)/)?.[1]
    if (version) device.os = `Android ${version}`
  } else if (userAgent.includes('iPhone OS') || userAgent.includes('iOS')) {
    device.os = 'iOS'
    const version = userAgent.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.')
    if (version) device.os = `iOS ${version}`
  }

  // Generate device name
  device.deviceName = `${device.os} - ${device.browser} (${device.deviceType})`

  return device
}

export async function getLocationFromIP(ipAddress: string): Promise<LocationInfo | null> {
  try {
    // Skip localhost and private IPs
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
      return {
        country: 'Local',
        city: 'Local',
        region: 'Local',
        timezone: 'Local'
      }
    }

    // Use a free IP geolocation service
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,regionName,city,lat,lon,timezone`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch location')
    }

    const data = await response.json()
    
    if (data.status === 'success') {
      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone
      }
    }
  } catch (error) {
    console.warn('Failed to get location from IP:', error)
  }

  return null
}

export function getClientIP(request: NextRequest): string {
  // Priority order for real IP detection
  const headers = [
    'cf-connecting-ip',        // Cloudflare
    'x-real-ip',              // Nginx
    'x-forwarded-for',        // Load balancers/proxies
    'x-client-ip',            // Apache
    'x-cluster-client-ip',    // Cluster
    'x-forwarded',            // General
    'forwarded-for',          // General
    'forwarded'               // RFC 7239
  ]
  
  for (const header of headers) {
    const value = request.headers.get(header)
    if (value) {
      // Handle comma-separated IPs (take first one)
      const ip = value.split(',')[0].trim()
      // Validate IP format
      if (isValidIP(ip)) {
        return ip
      }
    }
  }
  
  // Fallback to request.ip or localhost
  return request.ip || '127.0.0.1'
}

function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

export async function getTrackingInfo(request: NextRequest): Promise<TrackingInfo> {
  const userAgent = request.headers.get('user-agent') || ''
  const ipAddress = getClientIP(request)
  
  const device = parseUserAgent(userAgent)
  const location = await getLocationFromIP(ipAddress)
  
  return {
    ipAddress,
    device,
    location: location || undefined
  }
}

export function formatDeviceInfo(device: DeviceInfo): string {
  return `${device.deviceName || 'Unknown Device'}`
}

export function formatLocationInfo(location?: LocationInfo): string {
  if (!location) return 'Unknown Location'
  
  if (location.country === 'Local') return 'Local Network'
  
  const parts = []
  if (location.city) parts.push(location.city)
  if (location.region && location.region !== location.city) parts.push(location.region)
  if (location.country) parts.push(location.country)
  
  return parts.join(', ') || 'Unknown Location'
}