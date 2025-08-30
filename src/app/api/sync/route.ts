import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'deploy':
        await execAsync('vercel --prod --yes');
        return NextResponse.json({ success: true, message: 'Deployed to production' });
      
      case 'sync-db':
        await execAsync('npx prisma db push');
        return NextResponse.json({ success: true, message: 'Database synced' });
      
      case 'build':
        await execAsync('npm run build');
        return NextResponse.json({ success: true, message: 'Build completed' });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Real-time sync API active',
    timestamp: new Date().toISOString()
  });
}