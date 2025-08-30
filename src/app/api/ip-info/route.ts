import { NextRequest, NextResponse } from 'next/server'
import { getClientIP, getLocationFromIP } from '@/lib/device-tracking'

export async function GET(request: NextRequest) {
  try {
    const realIP = getClientIP(request)
    const location = await getLocationFromIP(realIP)
    
    // Get all IP-related headers for debugging
    const headers = {
      'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
      'x-real-ip': request.headers.get('x-real-ip'),
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-client-ip': request.headers.get('x-client-ip'),
      'x-cluster-client-ip': request.headers.get('x-cluster-client-ip'),
      'x-forwarded': request.headers.get('x-forwarded'),
      'forwarded-for': request.headers.get('forwarded-for'),
      'forwarded': request.headers.get('forwarded'),
      'request-ip': request.ip
    }
    
    return NextResponse.json({
      success: true,
      data: {
        detectedIP: realIP,
        location: location,
        allHeaders: headers,
        isLocalhost: realIP === '127.0.0.1' || realIP === '::1',
        isPrivateIP: realIP.startsWith('192.168.') || realIP.startsWith('10.') || realIP.startsWith('172.')
      }
    })
    
  } catch (error) {
    console.error('IP info error:', error)
    return NextResponse.json(
      { error: 'Failed to get IP information' },
      { status: 500 }
    )
  }
}