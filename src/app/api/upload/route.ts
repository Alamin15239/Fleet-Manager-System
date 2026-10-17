import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { db } from '@/lib/db';
import { requireRolePermission } from '@/lib/permission-middleware';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received');
    
    const data = await request.formData();
    const type = String(data.get('type') || 'general').toLowerCase();
    const permissionResource = type === 'truck'
      ? 'trucks'
      : type === 'maintenance'
        ? 'maintenance'
        : 'admin';
    const user = await requireRolePermission(request, permissionResource, 'update');
    console.log('User authenticated for upload:', user.id);

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
    // Save file metadata to database
    try {
      // Persist file metadata in the Document table
      // (the Truck model has no documents field)
      

      
      await db.document.create({
        data: {
          title: filename,
          type: type || 'general',
          fileUrl: fileUrl,
          createdById: user.id
        }
      });
      console.log('File metadata saved to database');
    } catch (dbError) {
      console.error('Error saving file metadata to database:', dbError);
    }

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
    const message = error instanceof Error ? error.message : '';
    if (['No token provided', 'Invalid token', 'User not found or inactive'].includes(message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to upload files for this section' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
