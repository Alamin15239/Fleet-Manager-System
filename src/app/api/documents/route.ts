import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    return NextResponse.json({
      documents,
      pagination: {
        page: 1,
        limit: 20,
        total: documents.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, description, content } = body;

    if (!title || !type) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        title,
        type,
        description: description || '',
        content: content || '',
        version: 1,
        wordCount: content ? content.replace(/<[^>]*>/g, '').split(/\s+/).length : 0,
        createdById: 'user-1'
      }
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}