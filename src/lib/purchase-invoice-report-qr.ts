'use client'

export async function createPurchaseInvoiceReportQrDataUrl(url: string) {
  const { default: QRCode } = await import('qrcode')
  for (const errorCorrectionLevel of ['H', 'Q', 'M', 'L'] as const) {
    try {
      return await QRCode.toDataURL(url, { errorCorrectionLevel, margin: 1, width: 1024 })
    } catch {
      // Longer multi-vehicle links need a lower correction level to fit a QR code.
    }
  }
  throw new Error('This report link is too long for a QR code. Reduce the number of selected vehicles and try again.')
}
