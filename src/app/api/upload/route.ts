import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string, userId?: string };
    const userId = decoded.id || decoded.userId;
    if (!userId) return null;
    
    const user = await db.user.findUnique({ where: { id: userId } });
    return user;
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received');
    
    const user = await getUserFromToken(request);
    if (!user) {
      console.log('User authentication failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User authenticated:', user.email);
    
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      console.log('No file in form data');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.type);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('File buffer created, size:', buffer.length);

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    console.log('Uploads directory:', uploadsDir);
    
    try {
      await writeFile(join(uploadsDir, 'test'), '');
      console.log('Directory exists and is writable');
    } catch {
      // Directory doesn't exist, create it
      console.log('Creating uploads directory');
      const { mkdir } = await import('fs/promises');
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const filepath = join(uploadsDir, filename);
    console.log('Writing file to:', filepath);

    await writeFile(filepath, buffer);
    console.log('File written successfully');

    const fileUrl = `/uploads/${filename}`;

    // Return the format expected by FileUpload component
    const uploadedFile = {
      id: `file_${timestamp}`,
      name: filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: fileUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id
    };

    return NextResponse.json(uploadedFile, { status: 200 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}