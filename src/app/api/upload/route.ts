import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireRolePermission } from '@/lib/permission-middleware';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export async function POST(request: NextRequest) {
  try {
    // Authenticate before parsing an attacker-controlled multipart body.
    await requireAuth(request);
    const data = await request.formData();
    const type = String(data.get('type') || 'general').toLowerCase();
    const permissionResource = type === 'truck'
      ? 'trucks'
      : type === 'maintenance'
        ? 'maintenance'
        : 'admin';
    const user = await requireRolePermission(request, permissionResource, 'update');

    const submittedFile = data.get('file');
    if (!(submittedFile instanceof File) || submittedFile.size <= 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    const file = submittedFile;
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 10 MB.' }, { status: 413 });
    }

    const extension = ALLOWED_UPLOAD_TYPES[file.type];
    if (!extension) {
      return NextResponse.json({ error: 'Unsupported file type. Upload an image, PDF, Word, or Excel document.' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Never use the client-provided filename as a filesystem path.
    const timestamp = Date.now();
    const filename = String(timestamp) + '-' + randomUUID() + extension;
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer, { flag: 'wx' });

    const fileUrl = '/uploads/' + filename;
    try {
      await db.document.create({
        data: {
          title: file.name.replace(/[\\r\\n]/g, '').slice(0, 180) || filename,
          type: type || 'general',
          fileUrl,
          createdById: user.id
        }
      });
    } catch (dbError) {
      console.error('Error saving file metadata to database:', dbError);
    }

    const uploadedFile = {
      id: 'file_' + timestamp,
      name: filename,
      originalName: file.name.replace(/[\\r\\n]/g, '').slice(0, 180),
      size: file.size,
      type: file.type,
      url: fileUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id
    };

    return NextResponse.json(uploadedFile, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    const message = error instanceof Error ? error.message : '';
    if (['No token provided', 'Invalid token', 'User not found or inactive'].includes(message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to upload files for this section' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
