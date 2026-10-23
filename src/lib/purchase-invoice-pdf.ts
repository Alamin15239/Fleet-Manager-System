interface PurchaseInvoicePdfOptions {
  orientation?: 'portrait' | 'landscape'
  pageSelector?: string
  pageWidthPx?: number
  pageHeightPx?: number
}

export async function downloadPurchaseInvoicePdf(documentHtml: string, filename: string, options: PurchaseInvoicePdfOptions = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const orientation = options.orientation || 'portrait'
  const pageWidthPx = options.pageWidthPx || 794
  const pageHeightPx = options.pageHeightPx || 1123
  const pageSelector = options.pageSelector || '.print-page'
  const pageWidthMm = orientation === 'landscape' ? 297 : 210
  const pageHeightMm = orientation === 'landscape' ? 210 : 297
  let frame: HTMLIFrameElement | null = null

  try {
    frame = document.createElement('iframe')
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageWidthPx + 30}px;height:${pageHeightPx + 30}px;border:0;background:#fff`
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument
    if (!frameDocument) throw new Error('Unable to prepare the invoice PDF')
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Timed out preparing the invoice PDF')), 10000)
      frame!.onload = () => { window.clearTimeout(timer); resolve() }
    })
    frameDocument.open()
    frameDocument.write(documentHtml)
    frameDocument.close()
    await loaded

    await Promise.all(Array.from(frameDocument.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load the invoice QR code'))
    })))

    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>(pageSelector))
    if (!pages.length) throw new Error('Unable to render the invoice pages')
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true })

    for (const [index, page] of pages.entries()) {
      page.style.width = `${pageWidthPx}px`
      page.style.height = `${pageHeightPx}px`
      page.style.margin = '0'
      const qrImage = page.querySelector<HTMLImageElement>('.scan-block img')
      const pageRect = page.getBoundingClientRect()
      const qrRect = qrImage?.getBoundingClientRect()
      const qrSource = qrImage?.src
      if (qrImage) qrImage.style.visibility = 'hidden'
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: pageWidthPx + 30, windowHeight: pageHeightPx + 30 })
      if (qrImage) qrImage.style.visibility = 'visible'

      if (index > 0) pdf.addPage('a4', orientation)
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidthMm, pageHeightMm)
      if (qrRect && qrSource && pageRect.width && pageRect.height) {
        const x = ((qrRect.left - pageRect.left) / pageRect.width) * pageWidthMm
        const y = ((qrRect.top - pageRect.top) / pageRect.height) * pageHeightMm
        const width = (qrRect.width / pageRect.width) * pageWidthMm
        const height = (qrRect.height / pageRect.height) * pageHeightMm
        pdf.addImage(qrSource, 'PNG', x, y, width, height)
      }
    }

    pdf.save(filename)
  } finally {
    frame?.remove()
  }
}
