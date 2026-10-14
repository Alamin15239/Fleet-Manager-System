export async function downloadJobCardPdf(documentHtml: string, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  let frame: HTMLIFrameElement | null = null

  try {
    frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:744px;height:1080px;border:0;background:#fff'
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument
    if (!frameDocument) throw new Error('Unable to prepare the PDF document')
    frameDocument.open()
    frameDocument.write(documentHtml)
    frameDocument.close()
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Timed out loading the job card for PDF')), 10000)
      frame!.onload = () => { window.clearTimeout(timer); resolve() }
    })

    const images = Array.from(frameDocument.images)
    await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load an image for the job-card PDF'))
    })))

    const page = frameDocument.querySelector<HTMLElement>('.print-page')
    if (!page) throw new Error('Unable to render the job card')
    const qrImage = frameDocument.querySelector<HTMLImageElement>('.scan-block img')
    const renderWidth = 744
    const renderHeight = 1080
    page.style.zoom = '1'
    page.style.width = `${renderWidth}px`
    page.style.maxWidth = `${renderWidth}px`
    page.style.margin = '0 auto'
    frameDocument.documentElement.style.width = `${renderWidth}px`
    frameDocument.body.style.width = `${renderWidth}px`
    frameDocument.body.style.minHeight = `${renderHeight}px`
    page.style.height = 'auto'
    const contentHeight = page.scrollHeight
    page.style.zoom = String(Math.min(1, renderHeight / contentHeight))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    // html2canvas can misplace nested-frame images when the page is CSS-zoomed.
    // Capture the QR's layout box, omit it from the raster, then draw it at that
    // same relative position in the final PDF so it remains crisp and scannable.
    const pageRect = page.getBoundingClientRect()
    const qrRect = qrImage?.getBoundingClientRect()
    const qrSource = qrImage?.src
    if (qrImage) qrImage.style.visibility = 'hidden'
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: renderWidth,
      windowHeight: Math.max(renderHeight, page.scrollHeight)
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = 210
    const pageHeight = 297
    const pageMargin = 5
    const scaleToFit = Math.min((pageWidth - pageMargin * 2) / canvas.width, (pageHeight - pageMargin * 2) / canvas.height)
    const imageWidth = canvas.width * scaleToFit
    const imageHeight = canvas.height * scaleToFit
    const imageX = (pageWidth - imageWidth) / 2
    const imageY = (pageHeight - imageHeight) / 2
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imageX, imageY, imageWidth, imageHeight)

    if (qrRect && qrSource && pageRect.width && pageRect.height) {
      const qrX = imageX + ((qrRect.left - pageRect.left) / pageRect.width) * imageWidth
      const qrY = imageY + ((qrRect.top - pageRect.top) / pageRect.height) * imageHeight
      const qrWidth = (qrRect.width / pageRect.width) * imageWidth
      const qrHeight = (qrRect.height / pageRect.height) * imageHeight
      pdf.addImage(qrSource, 'PNG', qrX, qrY, qrWidth, qrHeight)
    }

    pdf.save(filename)
  } finally {
    frame?.remove()
  }
}
