import { Server } from 'socket.io'

/**
 * Database schema changes and application deployments must never be triggered
 * by a browser real-time sync process. Vercel production uses serverless route
 * handlers, so this legacy process is intentionally disabled.
 */
export class RealtimeSync {
  constructor(_io: Server, _config: unknown) {}

  async start() {
    console.warn('Legacy RealtimeSync is disabled. Use authenticated application data APIs for live updates.')
  }

  stop() {
    // No background watchers or database mutations are started.
  }
}
