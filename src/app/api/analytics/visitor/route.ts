import { NextRequest, NextResponse } from 'next/server'
import { controlDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseUserAgent } from '@/lib/device-tracking'

export const dynamic = 'force-dynamic'

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.slice(0, max) : ''

function getIp(request: NextRequest) {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ]
  return candidates.find(Boolean)?.slice(0, 64) || null
}

function headerValue(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name)
    if (value) {
      try { return decodeURIComponent(value).slice(0, 120) } catch { return value.slice(0, 120) }
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const visitorId = clean(body.visitorId, 100)
    const sessionId = clean(body.sessionId, 100)
    const domain = clean(body.domain || request.nextUrl.hostname, 253).toLowerCase()
    const pagePath = clean(body.pagePath, 1000)
    const eventType = body.eventType === 'heartbeat' ? 'heartbeat' : 'pageview'
    const isIdle = body.isIdle === true

    if (!/^[a-zA-Z0-9_-]{12,100}$/.test(visitorId) ||
        !/^[a-zA-Z0-9_-]{12,100}$/.test(sessionId) ||
        !pagePath.startsWith('/') || pagePath.startsWith('//')) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    let userId: string | null = null
    try {
      const user = await requireAuth(request)
      userId = user.id
    } catch {
      // Anonymous public visitors are intentionally supported.
    }

    const userAgent = clean(request.headers.get('user-agent'), 1000)
    const device = parseUserAgent(userAgent)
    const ipAddress = getIp(request)
    const now = new Date()
    const existing = await (controlDb as any).websiteVisitorSession.findUnique({
      where: { sessionId },
      select: { id: true, pages: true, pageViews: true }
    })
    const previousPages = Array.isArray(existing?.pages) ? existing.pages : []
    const pages = eventType === 'pageview' && previousPages[previousPages.length - 1] !== pagePath
      ? [...previousPages, { path: pagePath, at: now.toISOString() }].slice(-100)
      : previousPages

    const location = {
      country: headerValue(request, ['x-vercel-ip-country', 'cf-ipcountry']),
      region: headerValue(request, ['x-vercel-ip-country-region', 'x-vercel-ip-region']),
      city: headerValue(request, ['x-vercel-ip-city', 'cf-ipcity']),
      timezone: headerValue(request, ['x-vercel-ip-timezone']),
    }
    const isBot = /bot|crawler|spider|slurp|headless|preview/i.test(userAgent)

    await (controlDb as any).websiteVisitorSession.upsert({
      where: { sessionId },
      create: {
        visitorId, sessionId, domain, userId, pagePath, pages,
        referrer: clean(body.referrer, 1000) || null,
        source: clean(body.source, 200) || null,
        medium: clean(body.medium, 200) || null,
        campaign: clean(body.campaign, 200) || null,
        ipAddress, country: location.country, region: location.region,
        city: location.city, timezone: location.timezone,
        userAgent, browser: device.browser, os: device.os,
        deviceType: device.deviceType, startedAt: now, lastSeenAt: now, isIdle,
        pageViews: eventType === 'pageview' ? 1 : 0, isBot,
      },
      update: {
        userId: userId || undefined,
        pagePath, pages, ipAddress,
        country: location.country || undefined,
        region: location.region || undefined,
        city: location.city || undefined,
        timezone: location.timezone || undefined,
        lastSeenAt: now, endedAt: null, isIdle,
        pageViews: eventType === 'pageview' && previousPages[previousPages.length - 1] !== pagePath
          ? { increment: 1 } : undefined,
      }
    })

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Visitor tracking error:', error)
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
