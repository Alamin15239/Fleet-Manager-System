import { NextRequest, NextResponse } from 'next/server';

// Mock documents storage
let documents: any[] = [];

export async function GET() {
  return NextResponse.json({
    documents,
    pagination: {
      page: 1,
      limit: 20,
      total: documents.length,
      pages: 1
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, content } = body;

    const document = {
      id: Date.now().toString(),
      title,
      type,
      content: content || '',
      version: 1,
      wordCount: content ? content.replace(/<[^>]*>/g, '').split(/\s+/).length : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    documents.push(document);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}