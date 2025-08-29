import puppeteer from 'puppeteer';
import { generateQRCode } from './qrCode';

export async function generatePDF(documentId: string, content: string, title: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Generate QR code for the document
    const documentUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/document/${documentId}`;
    const qrCodeDataUrl = await generateQRCode(documentUrl);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { margin-bottom: 40px; }
            .qr-section { text-align: center; margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
            .qr-code { margin: 10px 0; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="qr-section">
            <p>Scan to view online:</p>
            <div class="qr-code">
              <img src="${qrCodeDataUrl}" alt="QR Code" />
            </div>
            <p><small>${documentUrl}</small></p>
          </div>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    return pdf;
  } finally {
    await browser.close();
  }
}