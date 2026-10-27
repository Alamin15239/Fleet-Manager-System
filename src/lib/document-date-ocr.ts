type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>
}

type TesseractApi = {
  createWorker: (languages: string | string[]) => Promise<OcrWorker>
}

export type DocumentDates = {
  validFrom?: string
  validUntil?: string
}

declare global {
  interface Window {
    Tesseract?: TesseractApi
  }
}

const tesseractVersion = '7.0.0'
let tesseractLoad: Promise<TesseractApi> | null = null
let ocrWorker: Promise<OcrWorker> | null = null

function loadTesseract(): Promise<TesseractApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Document OCR is available in the browser.'))
  if (window.Tesseract) return Promise.resolve(window.Tesseract)
  if (tesseractLoad) return tesseractLoad

  tesseractLoad = new Promise<TesseractApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://cdn.jsdelivr.net/npm/tesseract.js@${tesseractVersion}/dist/tesseract.min.js`
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(new Error('Could not initialize document OCR.'))
    script.onerror = () => reject(new Error('Could not load document OCR.'))
    document.head.appendChild(script)
  }).catch(error => {
    tesseractLoad = null
    throw error
  })

  return tesseractLoad
}

function getWorker() {
  if (!ocrWorker) {
    ocrWorker = loadTesseract()
      .then(tesseract => tesseract.createWorker(['eng', 'ara']))
      .catch(error => {
        ocrWorker = null
        throw error
      })
  }
  return ocrWorker
}

function normalizeDigits(value: string) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  return value
    .replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(persianDigits.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
}

function dateKey(year: number, month: number, day: number) {
  if (year >= 1300 && year <= 1600) return hijriDateKey(year, month, day)
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function expandShortYear(year: number) {
  if (year >= 100) return year
  return year <= 49 ? 2000 + year : 1900 + year
}

function hijriDateKey(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 30) return null
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
    })
    const approximateYear = year + 579
    const start = Date.UTC(approximateYear - 1, 0, 1)
    const end = Date.UTC(approximateYear + 2, 0, 1)
    for (let timestamp = start; timestamp < end; timestamp += 86_400_000) {
      const parts = formatter.formatToParts(new Date(timestamp))
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
      if (Number(values.year) === year && Number(values.month) === month && Number(values.day) === day) {
        return new Date(timestamp).toISOString().slice(0, 10)
      }
    }
  } catch {
    return null
  }
  return null
}

type DateCandidate = { value: string; index: number; end: number; label?: 'issue' | 'expiry' }

const monthNumbers: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
}

const issueWords = ['issue date', 'date of issue', 'issued on', 'date issued', 'issued', 'valid from', 'effective from', 'start date', 'تاريخ الإصدار', 'تاريخ الاصدار', 'تاريخ اصدار', 'تاريخ البداية', 'بداية الصلاحية', 'صادر في']
const expiryWords = ['expiry date', 'expiration date', 'expires on', 'expiry', 'expiration', 'expires', 'valid until', 'valid to', 'valid till', 'valid through', 'end date', 'date of expiry', 'تاريخ الانتهاء', 'تاريخ انتهاء', 'تاريخ انتهاء الصلاحية', 'تاريخ الصلاحية', 'انتهاء الصلاحية', 'انتهاء', 'صالحة حتى', 'صالح حتى', 'يسري حتى', 'ساري حتى', 'سارية حتى']

function normalizeLabelText(value: string) {
  return value.toLocaleLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670ـ]/g, '')
    .replace(/[：]/g, ':')
}

function nearestWordDistance(text: string, words: string[], index: number) {
  const normalized = normalizeLabelText(text)
  let nearest = Number.POSITIVE_INFINITY
  for (const word of words) {
    const needle = normalizeLabelText(word)
    let position = normalized.indexOf(needle)
    while (position >= 0) {
      const distance = index < position ? position - index : index > position + needle.length ? index - position - needle.length : 0
      nearest = Math.min(nearest, distance)
      position = normalized.indexOf(needle, position + 1)
    }
  }
  return nearest
}

function labelCandidates(text: string, candidates: DateCandidate[]) {
  return candidates.map(candidate => {
    const start = Math.max(0, candidate.index - 90)
    const end = Math.min(text.length, candidate.end + 90)
    const context = text.slice(start, end)
    const issueDistance = nearestWordDistance(context, issueWords, candidate.index - start)
    const expiryDistance = nearestWordDistance(context, expiryWords, candidate.index - start)
    const issueIsNear = issueDistance <= 70
    const expiryIsNear = expiryDistance <= 70
    const label: DateCandidate['label'] = issueIsNear && (!expiryIsNear || issueDistance < expiryDistance)
      ? 'issue'
      : expiryIsNear && (!issueIsNear || expiryDistance < issueDistance)
        ? 'expiry'
        : undefined
    return { ...candidate, label }
  })
}

function parseDateCandidates(rawText: string): DateCandidate[] {
  // Saudi vehicle and driver cards commonly mix Arabic/English labels, Arabic-Indic
  // digits, Gregorian dates, and Hijri dates. Normalize digits before parsing.
  const text = normalizeDigits(rawText)
    .replace(/[٫]/g, '.')
    .replace(/[٬]/g, ',')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\u00a0/g, ' ');
  const candidates: DateCandidate[] = [];
  const numericDate = /(?<!\d)(\d{1,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,4})(?!\d)/g;

  for (const match of text.matchAll(numericDate)) {
    const firstText = match[1];
    const secondText = match[2];
    const thirdText = match[3];
    const first = Number(firstText);
    const second = Number(secondText);
    const third = Number(thirdText);
    let value: string | null = null;

    if (firstText.length === 4) {
      // ISO/YMD dates must keep the third component as the day. Expanding it
      // as a short year was the cause of incorrect YYYY/MM/DD results.
      value = dateKey(first, second, third);
    } else {
      const year = expandShortYear(third);
      // Saudi cards normally use DD/MM/YYYY. If the first component cannot be
      // a month, the order is definitely DMY; if the second cannot be a month,
      // interpret it as MDY. For ambiguous dates, prefer Saudi DMY convention.
      if (first > 12) {
        value = dateKey(year, second, first);
      } else if (second > 12) {
        value = dateKey(year, first, second);
      } else {
        value = dateKey(year, second, first);
      }
    }

    if (value && match.index !== undefined) {
      candidates.push({ value, index: match.index, end: match.index + match[0].length });
    }
  }

  const monthPattern = /(?:(\d{1,2})\s+([a-z]{3,9})\.?[,]?\s+((?:19|20)\d{2})|\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+((?:19|20)\d{2}))/gi;
  for (const match of text.matchAll(monthPattern)) {
    const day = Number(match[1] || match[5]);
    const month = monthNumbers[(match[2] || match[4] || '').toLowerCase()];
    const year = Number(match[3] || match[6]);
    const value = month ? dateKey(year, month, day) : null;
    if (value && match.index !== undefined) {
      candidates.push({ value, index: match.index, end: match.index + match[0].length });
    }
  }

  const labeled = labelCandidates(text, candidates).sort((a, b) => a.index - b.index);
  // OCR and embedded PDF text may report the same date twice. Keep the first
  // occurrence, but retain separate dates so labels can distinguish issue/expiry.
  return labeled.filter((candidate, index) =>
    labeled.findIndex(item => item.value === candidate.value && item.label === candidate.label) === index,
  );
}

export function extractDocumentDates(rawText: string): DocumentDates {
  const candidates = parseDateCandidates(rawText)
  if (!candidates.length) return {}

  const normalizedText = normalizeLabelText(normalizeDigits(rawText))
  const hasAny = (value: string, terms: string[]) => terms.some(term => value.includes(normalizeLabelText(term)))
  const cardTerms = ['operation card', 'card issue date', 'card expiry date', 'card expiration date', 'بطاقة التشغيل', 'تاريخ إصدار البطاقة', 'تاريخ انتهاء البطاقة', 'تاريخ اصدار البطاقة']
  const cardIssueTerms = ['card issue date', 'تاريخ إصدار البطاقة', 'تاريخ اصدار البطاقة', 'تاريخ اصدار بطاقة التشغيل']
  const cardExpiryTerms = ['card expiry date', 'card expiration date', 'تاريخ انتهاء البطاقة', 'تاريخ انتهاء صلاحية البطاقة', 'تاريخ انتهاء بطاقة التشغيل']
  const licenseIssueTerms = ['license issue date', 'license issuance date', 'تاريخ إصدار الترخيص', 'تاريخ اصدار الترخيص']
  const licenseExpiryTerms = ['license expiry date', 'license expiration date', 'تاريخ انتهاء الترخيص', 'تاريخ انتهاء صلاحية الترخيص']

  // When the file is an Operation Card, only use dates tied to the card's own
  // issue/expiry labels. The same page may also show a company transport-license
  // section; generic issue/expiry fallback would silently save those dates as
  // the card's dates.
  if (hasAny(normalizedText, cardTerms)) {
    const nearestCardCandidate = (cardLabels: string[], licenseLabels: string[]) => {
      const ranked = candidates.map(candidate => ({
        candidate,
        cardDistance: nearestWordDistance(normalizedText, cardLabels, candidate.index),
        licenseDistance: nearestWordDistance(normalizedText, licenseLabels, candidate.index),
      })).filter(item => item.cardDistance <= 90 && item.cardDistance < item.licenseDistance)
        .sort((a, b) => a.cardDistance - b.cardDistance)
      return ranked[0]?.candidate
    }
    const issue = nearestCardCandidate(cardIssueTerms, licenseIssueTerms)
    const expiry = nearestCardCandidate(cardExpiryTerms, licenseExpiryTerms)
    return { validFrom: issue?.value, validUntil: expiry?.value }
  }

  const issueCandidates = candidates.filter(candidate => candidate.label === 'issue')
  const expiryCandidates = candidates.filter(candidate => candidate.label === 'expiry')
  let validFrom = issueCandidates[0]?.value
  let validUntil = expiryCandidates[0]?.value

  // Insurance certificates often state the policy period without explicit
  // "valid from/until" labels. In that case, use the two dates in the period.
  if (!validFrom && !validUntil) {
    const chronological = [...new Set(candidates.map(candidate => candidate.value))].sort()
    if (chronological.length > 1) {
      validFrom = chronological[0]
      validUntil = chronological[chronological.length - 1]
    } else {
      validUntil = chronological[0]
    }
  }

  return { validFrom, validUntil }
}

async function imageToCanvas(file: File) {
  let image: CanvasImageSource
  let width: number
  let height: number
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    image = bitmap
    width = bitmap.width
    height = bitmap.height
  } else {
    const url = URL.createObjectURL(file)
    try {
      const element = new Image()
      element.src = url
      await element.decode()
      image = element
      width = element.naturalWidth
      height = element.naturalHeight
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const scale = Math.min(1, 2200 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the image for date reading.')
  context.filter = 'grayscale(1) contrast(1.15)'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  if ('close' in image && typeof image.close === 'function') image.close()
  return canvas
}

async function readPdfDates(file: File): Promise<DocumentDates> {
  const { pdfjs } = await import('react-pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await loadingTask.promise
    const pageCount = Math.min(pdf.numPages, 3)
    const pages: Array<{ page: Awaited<ReturnType<typeof pdf.getPage>>; text: string }> = []
    let text = ''
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => 'str' in item ? item.str : '').join(' ')
      pages.push({ page, text: pageText })
      text += `${pageText}\n`
    }

    let dates = extractDocumentDates(text)
    if (dates.validFrom && dates.validUntil) return dates

    const worker = await getWorker()
    for (const { page } of pages) {
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(1.8, 2200 / Math.max(baseViewport.width, baseViewport.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) continue
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const recognized = await worker.recognize(canvas)
      text += `${recognized.data.text}\n`
      dates = extractDocumentDates(text)
      canvas.width = 0
      canvas.height = 0
      if (dates.validFrom && dates.validUntil) return dates
    }
    return dates
  } finally {
    await loadingTask.destroy()
  }
}

/**
 * Build a high-contrast variant for cards photographed in uneven light.
 * Thresholding is deliberately a second pass: some Arabic glyphs disappear
 * when thresholded, so the original grayscale image is always tried first.
 */
function makeThresholdCanvas(source: HTMLCanvasElement, invert = false) {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.drawImage(source, 0, 0)
  const frame = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = frame.data
  for (let i = 0; i < pixels.length; i += 4) {
    const luminance = (pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114)
    const value = (luminance > 165) !== invert ? 255 : 0
    pixels[i] = value
    pixels[i + 1] = value
    pixels[i + 2] = value
  }
  context.putImageData(frame, 0, 0)
  return canvas
}

export async function readDocumentDates(file: File): Promise<DocumentDates> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (isPdf) return readPdfDates(file)

  const canvas = await imageToCanvas(file)
  const worker = await getWorker()
  const recognizedText: string[] = []
  const variants: HTMLCanvasElement[] = [canvas]
  try {
    // Try the normal grayscale/contrast image first; only do extra passes when
    // it fails to find dates, so the common path stays quick.
    const first = await worker.recognize(canvas)
    recognizedText.push(first.data.text)
    let dates = extractDocumentDates(recognizedText.join('\n'))
    if (dates.validFrom && dates.validUntil) return dates
    if (dates.validFrom || dates.validUntil) {
      // Keep the initial candidate but check enhanced variants for the missing field.
    }

    const threshold = makeThresholdCanvas(canvas)
    variants.push(threshold)
    const second = await worker.recognize(threshold)
    recognizedText.push(second.data.text)
    dates = extractDocumentDates(recognizedText.join('\n'))
    if (dates.validFrom && dates.validUntil) return dates

    // White-on-dark photos and reflective card surfaces can benefit from an
    // inverted threshold pass. Merge OCR text rather than trusting one pass.
    const inverted = makeThresholdCanvas(canvas, true)
    variants.push(inverted)
    const third = await worker.recognize(inverted)
    recognizedText.push(third.data.text)
    return extractDocumentDates(recognizedText.join('\n'))
  } finally {
    for (const variant of variants) {
      variant.width = 0
      variant.height = 0
    }
  }
}
