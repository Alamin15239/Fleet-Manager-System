import { NextRequest, NextResponse } from 'next/server';

// Mock documents storage - shared across routes
if (!global.documents) {
  global.documents = [];
}
const documents = global.documents;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const document = documents.find(doc => doc.id === params.id);
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  return NextResponse.json(document);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { title, content } = body;
  
  const docIndex = documents.findIndex(doc => doc.id === params.id);
  if (docIndex === -1) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  
  documents[docIndex] = {
    ...documents[docIndex],
    title,
    content,
    updatedAt: new Date().toISOString()
  };
  
  return NextResponse.json(documents[docIndex]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const docIndex = documents.findIndex(doc => doc.id === params.id);
  if (docIndex === -1) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  
  documents.splice(docIndex, 1);
  return NextResponse.json({ message: 'Document deleted' });
}