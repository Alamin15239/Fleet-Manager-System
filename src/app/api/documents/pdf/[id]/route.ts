import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePDF } from '@/lib/puppeteer';
import { requireAuth } from '@/lib/auth';

function convertEditorStateToHTML(editorState: any): string {
  if (!editorState) return '';
  
  if (typeof editorState === 'string') {
    return editorState;
  }
  
  if (editorState.type === 'doc' && editorState.content) {
    let html = '';
    for (const node of editorState.content) {
      if (node.type === 'paragraph') {
        const text = node.content?.map((c: any) => c.text || '').join('') || '';
        html += `<p>${text}</p>`;
      } else if (node.type === 'heading') {
        const text = node.content?.map((c: any) => c.text || '').join('') || '';
        const level = node.attrs?.level || 1;
        html += `<h${level}>${text}</h${level}>`;
      } else if (node.type === 'table') {
        html += '<table>';
        for (const row of node.content || []) {
          html += '<tr>';
          for (const cell of row.content || []) {
            const cellText = cell.content?.map((p: any) => 
              p.content?.map((c: any) => c.text || '').join('') || ''
            ).join('') || '';
            html += `<td>${cellText}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
      }
    }
    return html;
  }
  
  return JSON.stringify(editorState);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const document = await db.document.findUnique({
      where: { id }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let content = '';
    
    if (document.type === 'text' && document.editorState) {
      content = convertEditorStateToHTML(document.editorState);
    } else if (document.fileUrl) {
      content = `<p>File: <a href="${document.fileUrl}">${document.title}</a></p>`;
    } else {
      content = '<p>No content available</p>';
    }

    const pdfBuffer = await generatePDF(id, content, document.title);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}