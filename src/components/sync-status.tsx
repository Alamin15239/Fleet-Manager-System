'use client';

import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, Database, Build } from 'lucide-react';

export function SyncStatus() {
  const { status, triggerSync } = useRealtimeSync();

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
      <Badge variant={status.connected ? 'default' : 'destructive'}>
        {status.connected ? 'Connected' : 'Disconnected'}
      </Badge>
      
      {status.syncing && (
        <RefreshCw className="h-4 w-4 animate-spin" />
      )}
      
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerSync('deploy')}
          disabled={status.syncing}
        >
          <Zap className="h-3 w-3" />
          Deploy
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerSync('sync-db')}
          disabled={status.syncing}
        >
          <Database className="h-3 w-3" />
          Sync DB
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerSync('build')}
          disabled={status.syncing}
        >
          <Build className="h-3 w-3" />
          Build
        </Button>
      </div>
      
      {status.error && (
        <span className="text-xs text-destructive">{status.error}</span>
      )}
    </div>
  );
}