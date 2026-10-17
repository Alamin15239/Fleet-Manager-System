export async function downloadPurchaseInvoicePdf(documentHtml: string, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  let frame: HTMLIFrameElement | null = null

  try {
    frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;height:1160px;border:0;background:#fff'
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

    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>('.print-page'))
    if (!pages.length) throw new Error('Unable to render the invoice pages')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

    for (const [index, page] of pages.entries()) {
      page.style.width = '794px'
      page.style.height = '1123px'
      page.style.margin = '0'
      const qrImage = page.querySelector<HTMLImageElement>('.scan-block img')
      const pageRect = page.getBoundingClientRect()
      const qrRect = qrImage?.getBoundingClientRect()
      const qrSource = qrImage?.src
      if (qrImage) qrImage.style.visibility = 'hidden'
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 820, windowHeight: 1160 })
      if (qrImage) qrImage.style.visibility = 'visible'

      if (index > 0) pdf.addPage('a4', 'portrait')
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
      if (qrRect && qrSource && pageRect.width && pageRect.height) {
        const x = ((qrRect.left - pageRect.left) / pageRect.width) * 210
        const y = ((qrRect.top - pageRect.top) / pageRect.height) * 297
        const width = (qrRect.width / pageRect.width) * 210
        const height = (qrRect.height / pageRect.height) * 297
        pdf.addImage(qrSource, 'PNG', x, y, width, height)
      }
    }

    pdf.save(filename)
  } finally {
    frame?.remove()
  }
}
