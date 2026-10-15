import { Server } from 'socket.io';
import { watch } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

interface SyncConfig {
  production: { url: string; apiKey: string };
  local: { url: string; port: number };
  syncEnabled: boolean;
  syncInterval: number;
  watchPaths: string[];
}

class RealtimeSync {
  private config: SyncConfig;
  private io: Server;
  private watchers: any[] = [];

  constructor(io: Server, config: SyncConfig) {
    this.io = io;
    this.config = config;
  }

  async start() {
    if (!this.config.syncEnabled) return;

    console.log('🔄 Starting real-time sync...');
    
    // Watch for file changes
    this.setupFileWatchers();
    
    // Setup database sync
    this.setupDatabaseSync();
    
    // Setup API sync
    this.setupApiSync();
  }

  private setupFileWatchers() {
    this.config.watchPaths.forEach(path => {
      const watcher = watch(path, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
          console.log(`📁 File changed: ${filename}`);
          this.syncToProduction(filename);
        }
      });
      this.watchers.push(watcher);
    });
  }

  private async syncToProduction(filename: string) {
    try {
      // Auto-deploy to production
      await execAsync('vercel --prod --yes');
      
      // Notify all connected clients
      this.io.emit('sync-update', {
        type: 'file-change',
        filename,
        timestamp: new Date().toISOString(),
        status: 'deployed'
      });
      
      console.log(`✅ Synced ${filename} to production`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`❌ Sync failed for ${filename}:`, message);
      this.io.emit('sync-error', { filename, error: message });
    }
  }

  private setupDatabaseSync() {
    // Watch for database changes
    setInterval(async () => {
      try {
        // Push schema changes to production
        await execAsync('npx prisma db push --force-reset');
        
        this.io.emit('sync-update', {
          type: 'database-sync',
          timestamp: new Date().toISOString(),
          status: 'synced'
        });
      } catch (error) {
        console.error('Database sync error:', error);
      }
    }, this.config.syncInterval * 5); // Every 5 seconds
  }

  private setupApiSync() {
    // Real-time API endpoint sync
    this.io.on('connection', (socket) => {
      socket.on('api-change', async (data) => {
        try {
          // Sync API changes to production
          await this.deployToProduction();
          socket.emit('api-synced', { success: true });
        } catch (error) {
          socket.emit('api-sync-error', { error: error instanceof Error ? error.message : String(error) });
        }
      });
    });
  }

  private async deployToProduction() {
    await execAsync('vercel --prod --yes');
  }

  stop() {
    this.watchers.forEach(watcher => watcher.close());
    console.log('🛑 Real-time sync stopped');
  }
}

export { RealtimeSync };
