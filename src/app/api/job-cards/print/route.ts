import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import puppeteer from 'puppeteer'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jobCardId } = body

    const jobCard = await prisma.jobCard.findUnique({
      where: { id: jobCardId },
      include: {
        maintenanceRecord: {
          include: {
            truck: true,
            mechanic: true
          }
        },
        template: true
      }
    })

    if (!jobCard) {
      return NextResponse.json({ error: 'Job card not found' }, { status: 404 })
    }

    // Log the print action
    await prisma.jobCardPrint.create({
      data: {
        jobCardId,
        printedBy: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Generate PDF
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    
    const html = generateJobCardHTML(jobCard)
    await page.setContent(html)
    
    const pdf = await page.pdf({
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

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="job-card-${jobCard.jobCardNumber}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error printing job card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateJobCardHTML(jobCard: any): string {
  const { maintenanceRecord, jobCardNumber, qrCode } = jobCard
  const { truck, mechanic } = maintenanceRecord

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Job Card - ${jobCardNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .job-number { font-size: 24px; font-weight: bold; color: #333; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 16px; font-weight: bold; background: #f5f5f5; padding: 8px; border-left: 4px solid #007bff; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
        .info-item { padding: 8px; border: 1px solid #ddd; }
        .info-label { font-weight: bold; color: #555; }
        .signature-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
        .signature-box { border: 1px solid #333; height: 80px; text-align: center; padding-top: 60px; }
        .qr-code { text-align: center; margin-top: 20px; }
        .qr-code img { width: 100px; height: 100px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>MAINTENANCE JOB CARD</h1>
        <div class="job-number">Job Card #: ${jobCardNumber}</div>
        <div>Date: ${new Date(maintenanceRecord.datePerformed).toLocaleDateString()}</div>
      </div>

      <div class="section">
        <div class="section-title">Vehicle Information</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Vehicle:</div>
            ${truck ? `${truck.year} ${truck.make} ${truck.model}` : 'N/A'}
          </div>
          <div class="info-item">
            <div class="info-label">License Plate:</div>
            ${truck?.licensePlate || 'N/A'}
          </div>
          <div class="info-item">
            <div class="info-label">VIN:</div>
            ${truck?.vin || 'N/A'}
          </div>
          <div class="info-item">
            <div class="info-label">Current Mileage:</div>
            ${maintenanceRecord.currentMileage || 'N/A'} km
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Service Information</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Service Type:</div>
            ${maintenanceRecord.serviceType}
          </div>
          <div class="info-item">
            <div class="info-label">Status:</div>
            ${maintenanceRecord.status}
          </div>
          <div class="info-item">
            <div class="info-label">Mechanic:</div>
            ${mechanic?.name || 'Not assigned'}
          </div>
          <div class="info-item">
            <div class="info-label">Parts Cost:</div>
            $${maintenanceRecord.partsCost.toFixed(2)}
          </div>
        </div>
        ${maintenanceRecord.description ? `
          <div style="margin-top: 15px;">
            <div class="info-label">Description:</div>
            <div style="border: 1px solid #ddd; padding: 10px; margin-top: 5px;">
              ${maintenanceRecord.description}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">Cost Breakdown</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Parts Cost:</div>
            $${maintenanceRecord.partsCost.toFixed(2)}
          </div>
          <div class="info-item">
            <div class="info-label">Labor Cost:</div>
            $${maintenanceRecord.laborCost.toFixed(2)}
          </div>
          <div class="info-item" style="grid-column: span 2; background: #f8f9fa; font-weight: bold;">
            <div class="info-label">Total Cost:</div>
            $${maintenanceRecord.totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      <div class="signature-section">
        <div>
          <div style="font-weight: bold; margin-bottom: 10px;">Customer Signature</div>
          <div class="signature-box">Sign Here</div>
        </div>
        <div>
          <div style="font-weight: bold; margin-bottom: 10px;">Mechanic Signature</div>
          <div class="signature-box">Sign Here</div>
        </div>
        <div>
          <div style="font-weight: bold; margin-bottom: 10px;">Supervisor Signature</div>
          <div class="signature-box">Sign Here</div>
        </div>
      </div>

      ${qrCode ? `
        <div class="qr-code">
          <div style="font-weight: bold; margin-bottom: 10px;">Quick Access QR Code</div>
          <img src="${qrCode}" alt="QR Code" />
        </div>
      ` : ''}
    </body>
    </html>
  `
}