import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import puppeteer from 'puppeteer'
import { generateQRCode } from '@/lib/qrCode'

// POST print job card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobCardId, userId, templateId } = body

    // Get job card data
    const jobCard = await db.jobCard.findUnique({
      where: { id: jobCardId },
      include: {
        maintenanceRecord: {
          include: {
            truck: true
          }
        },
        trailerMaintenanceRecord: {
          include: {
            trailer: true
          }
        },
        mechanic: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!jobCard) {
      return NextResponse.json(
        { error: 'Job card not found' },
        { status: 404 }
      )
    }

    // Get template
    let template
    if (templateId) {
      template = await db.jobCardTemplate.findUnique({
        where: { id: templateId }
      })
    } else {
      template = await db.jobCardTemplate.findFirst({
        where: { isDefault: true, isActive: true }
      })
    }

    if (!template) {
      // Use default template if none found
      template = {
        content: getDefaultTemplate()
      }
    }

    // Generate QR code
    const qrCodeUrl = `${process.env.NEXTAUTH_URL}/job-cards/${jobCard.qrToken}`
    const qrCodeDataUrl = await generateQRCode(qrCodeUrl)

    // Replace template tokens
    const htmlContent = replaceTemplateTokens(template.content, jobCard, qrCodeDataUrl)

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })
    
    await browser.close()

    // Update print audit
    await db.jobCard.update({
      where: { id: jobCardId },
      data: {
        printedBy: userId,
        printedAt: new Date(),
        printCount: {
          increment: 1
        }
      }
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="job-card-${jobCard.jobCardNo}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error printing job card:', error)
    return NextResponse.json(
      { error: 'Failed to print job card' },
      { status: 500 }
    )
  }
}

function getDefaultTemplate(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Job Card - {{jobCardNo}}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .job-card-no { font-size: 24px; font-weight: bold; color: #333; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 16px; font-weight: bold; background: #f5f5f5; padding: 8px; border-left: 4px solid #007bff; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
        .info-item { padding: 5px 0; }
        .label { font-weight: bold; color: #555; }
        .value { margin-left: 10px; }
        .tasks-table, .parts-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .tasks-table th, .tasks-table td, .parts-table th, .parts-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .tasks-table th, .parts-table th { background-color: #f8f9fa; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; }
        .signature-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
        .qr-code { text-align: center; margin-top: 30px; }
        .total-cost { font-size: 18px; font-weight: bold; color: #28a745; text-align: right; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>JOB CARD</h1>
        <div class="job-card-no">{{jobCardNo}}</div>
        <div>Date: {{createdDate}}</div>
      </div>

      <div class="section">
        <div class="section-title">Vehicle Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Vehicle:</span>
            <span class="value">{{vehicleName}}</span>
          </div>
          <div class="info-item">
            <span class="label">Registration:</span>
            <span class="value">{{vehicleIdentifier}}</span>
          </div>
          <div class="info-item">
            <span class="label">Driver:</span>
            <span class="value">{{driverName}}</span>
          </div>
          <div class="info-item">
            <span class="label">Odometer:</span>
            <span class="value">{{odometer}} km</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Service Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Mechanic:</span>
            <span class="value">{{mechanicName}}</span>
          </div>
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value">{{status}}</span>
          </div>
        </div>
        <div style="margin-top: 15px;">
          <div class="label">Reported Issues:</div>
          <div style="margin-top: 5px; padding: 10px; background: #f8f9fa; border-radius: 4px;">{{reportedIssues}}</div>
        </div>
        <div style="margin-top: 15px;">
          <div class="label">Requested Work:</div>
          <div style="margin-top: 5px; padding: 10px; background: #f8f9fa; border-radius: 4px;">{{requestedWork}}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Tasks</div>
        <table class="tasks-table">
          <thead>
            <tr>
              <th>Task Description</th>
              <th>Status</th>
              <th>Time (hrs)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {{tasks}}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Parts</div>
        <table class="parts-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Part Number</th>
              <th>Quantity</th>
              <th>Unit Cost</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {{parts}}
          </tbody>
        </table>
        <div class="total-cost">Total Cost: {{totalCost}}</div>
      </div>

      <div class="signatures">
        <div class="signature-box">
          <div>Customer Signature</div>
          <div style="margin-top: 20px;">Date: _____________</div>
        </div>
        <div class="signature-box">
          <div>Mechanic Signature</div>
          <div style="margin-top: 20px;">Date: _____________</div>
        </div>
        <div class="signature-box">
          <div>Supervisor Signature</div>
          <div style="margin-top: 20px;">Date: _____________</div>
        </div>
      </div>

      <div class="qr-code">
        <img src="{{qrCode}}" alt="QR Code" style="width: 100px; height: 100px;">
        <div style="margin-top: 10px; font-size: 12px; color: #666;">
          Scan to view job card details
        </div>
      </div>
    </body>
    </html>
  `
}

function replaceTemplateTokens(template: string, jobCard: any, qrCodeDataUrl: string): string {
  const tokens = {
    '{{jobCardNo}}': jobCard.jobCardNo || '',
    '{{createdDate}}': new Date(jobCard.createdAt).toLocaleDateString(),
    '{{vehicleName}}': jobCard.vehicleName || '',
    '{{vehicleIdentifier}}': jobCard.vehicleIdentifier || '',
    '{{driverName}}': jobCard.driverName || 'N/A',
    '{{mechanicName}}': jobCard.mechanicName || 'N/A',
    '{{odometer}}': jobCard.odometer?.toString() || 'N/A',
    '{{status}}': jobCard.status || '',
    '{{reportedIssues}}': jobCard.reportedIssues || 'None reported',
    '{{requestedWork}}': jobCard.requestedWork || 'None specified',
    '{{totalCost}}': `$${jobCard.totalCost?.toFixed(2) || '0.00'}`,
    '{{qrCode}}': qrCodeDataUrl,
    '{{tasks}}': generateTasksTable(jobCard.tasks),
    '{{parts}}': generatePartsTable(jobCard.parts)
  }

  let result = template
  Object.entries(tokens).forEach(([token, value]) => {
    result = result.replace(new RegExp(token, 'g'), value)
  })

  return result
}

function generateTasksTable(tasks: any[]): string {
  if (!tasks || tasks.length === 0) {
    return '<tr><td colspan="4" style="text-align: center; color: #666;">No tasks specified</td></tr>'
  }

  return tasks.map(task => `
    <tr>
      <td>${task.description || ''}</td>
      <td>${task.status || 'Pending'}</td>
      <td>${task.timeHours || '0'}</td>
      <td>${task.notes || ''}</td>
    </tr>
  `).join('')
}

function generatePartsTable(parts: any[]): string {
  if (!parts || parts.length === 0) {
    return '<tr><td colspan="5" style="text-align: center; color: #666;">No parts specified</td></tr>'
  }

  return parts.map(part => `
    <tr>
      <td>${part.name || ''}</td>
      <td>${part.partNumber || ''}</td>
      <td>${part.quantity || '0'}</td>
      <td>$${(part.unitCost || 0).toFixed(2)}</td>
      <td>$${((part.quantity || 0) * (part.unitCost || 0)).toFixed(2)}</td>
    </tr>
  `).join('')
}