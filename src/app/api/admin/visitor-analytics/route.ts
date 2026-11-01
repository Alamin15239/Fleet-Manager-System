import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { controlDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const liveSince = new Date(Date.now() - 2 * 60 * 1000)
    const where: any = { startedAt: { gte: since } }
    if (domain && domain !== 'all') where.domain = domain

    const [recent, totalToday, liveNow, uniqueVisitors] = await Promise.all([
      (controlDb as any).websiteVisitorSession.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        take: 150,
      }),
      (controlDb as any).websiteVisitorSession.count({
        where: { ...where, startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      }),
      (controlDb as any).websiteVisitorSession.count({
        where: { ...where, lastSeenAt: { gte: liveSince }, isBot: false }
      }),
      (controlDb as any).websiteVisitorSession.findMany({
        where, distinct: ['visitorId'], select: { visitorId: true }
      }),
    ])

    const humanSessions = recent.filter((session: any) => !session.isBot)
    const countries = new Map<string, number>()
    const pages = new Map<string, number>()
    for (const session of humanSessions) {
      const country = session.country || 'Unknown'
      countries.set(country, (countries.get(country) || 0) + 1)
      for (const page of Array.isArray(session.pages) ? session.pages : []) {
        const path = typeof page?.path === 'string' ? page.path : ''
        if (path) pages.set(path, (pages.get(path) || 0) + 1)
      }
    }

    const sessions = recent.map((session: any) => ({
      id: session.id, visitorId: session.visitorId, domain: session.domain,
      userId: session.userId, type: session.userId ? 'Registered user' : 'Anonymous visitor',
      pagePath: session.pagePath, pages: session.pages,
      referrer: session.referrer, source: session.source, medium: session.medium,
      campaign: session.campaign, ipAddress: session.ipAddress,
      country: session.country, region: session.region, city: session.city,
      timezone: session.timezone, browser: session.browser, os: session.os,
      deviceType: session.deviceType, startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt, pageViews: session.pageViews,
      isBot: session.isBot,
      status: session.isBot ? 'Bot' : session.lastSeenAt >= liveSince ? 'Active' :
        session.lastSeenAt >= new Date(Date.now() - 15 * 60 * 1000) ? 'Idle' : 'Inactive',
      durationSeconds: Math.max(0, Math.floor(((session.endedAt || session.lastSeenAt).getTime() - session.startedAt.getTime()) / 1000)),
    }))

    return NextResponse.json({
      success: true,
      stats: {
        liveNow, totalToday, uniqueVisitors: uniqueVisitors.length,
        pageViews: humanSessions.reduce((sum: number, session: any) => sum + session.pageViews, 0),
      },
      countries: [...countries.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      topPages: [...pages.entries()].map(([page, views]) => ({ page, views })).sort((a, b) => b.views - a.views).slice(0, 10),
      sessions,
      updatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = message === 'Insufficient permissions' ? 403 : 401
    return NextResponse.json({ error: status === 403 ? 'Admin access required' : 'Authentication required' }, { status })
  }
}
