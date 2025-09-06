import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, format, options } = body;

    if (!documentId || !format) {
      return NextResponse.json({ error: 'Document ID and format are required' }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let exportedContent = '';
    let contentType = '';
    let filename = '';

    switch (format.toLowerCase()) {
      case 'pdf':
        exportedContent = generatePDF(document.content || '', document.title);
        contentType = 'application/pdf';
        filename = `${document.title}.pdf`;
        break;
      
      case 'docx':
        exportedContent = generateDOCX(document.content || '', document.title);
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename = `${document.title}.docx`;
        break;
      
      case 'html':
        exportedContent = generateHTML(document.content || '', document.title);
        contentType = 'text/html';
        filename = `${document.title}.html`;
        break;
      
      case 'txt':
        exportedContent = stripHTML(document.content || '');
        contentType = 'text/plain';
        filename = `${document.title}.txt`;
        break;
      
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    return new NextResponse(exportedContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generatePDF(content: string, title: string): string {
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length ${content.length + title.length + 100}
>>
stream
BT
/F1 12 Tf
72 720 Td
(${title}) Tj
0 -20 Td
(${stripHTML(content)}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${300 + content.length + title.length}
%%EOF`;
}

function generateDOCX(content: string, title: string): string {
  const docxContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
      </w:pPr>
      <w:r>
        <w:t>${title}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>${stripHTML(content)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  
  return docxContent;
}

function generateHTML(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: Calibri, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #2196f3;
            padding-bottom: 10px;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${content}
</body>
</html>`;
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}