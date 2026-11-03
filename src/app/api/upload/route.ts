import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireRolePermission } from '@/lib/permission-middleware';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function hasFileSignature(buffer: Buffer, mimeType: string) {
  const startsWith = (signature: number[]) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(Buffer.from(signature))
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return startsWith([0xff, 0xd8, 0xff])
    case 'image/png':
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':
      return buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return startsWith([0x50, 0x4b, 0x03, 0x04])
    default:
      return false
  }
}
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
    if (!hasFileSignature(buffer, file.type)) {
      return NextResponse.json({ error: 'The uploaded file content does not match its declared file type.' }, { status: 415 });
    }
    const originalName = file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
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
          title: originalName || filename,
          type: type || 'general',
          fileUrl,
          createdById: user.id
        }
      });
    } catch (dbError) {
      console.error('Error saving file metadata to database:', dbError);
      // Do not report a successful upload when its metadata was not persisted.
      // Remove the just-written file to avoid an untracked orphan.
      try {
        await unlink(filepath);
      } catch (cleanupError) {
        console.error('Failed to clean up untracked upload:', cleanupError);
      }
      return NextResponse.json({ error: 'File metadata could not be saved. Please retry the upload.' }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const uploadedFile = {
      id: 'file_' + timestamp,
      name: filename,
      originalName: originalName || filename,
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
