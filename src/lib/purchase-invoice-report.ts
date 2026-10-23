export interface PurchaseInvoiceReportEntry {
  date: string
  invoiceNumber: string
  vendorInvoiceNumber?: string | null
  vendor: string
  account: string
  description: string
  debit: number
  credit: number
  status: 'POSTED' | 'VOID'
}

export interface PurchaseInvoiceReportCompany {
  companyName?: string | null
  companyAddress?: string | null
  companyPhone?: string | null
  companyEmail?: string | null
}

const categoryLabels: Record<string, string> = {
  MAINTENANCE: 'Maintenance', SPARE_PARTS: 'Spare parts', TIRE: 'Tire',
  BATTERY: 'Battery', OIL_FILTER: 'Oil & filter', OTHER: 'Other expense',
}

export function buildPurchaseInvoiceReportEntries(matches: Array<any>, assetLabels: Record<string, string> = {}): PurchaseInvoiceReportEntry[] {
  return matches.flatMap(({ invoice, lines }) => {
    const entries: PurchaseInvoiceReportEntry[] = lines.map((line: any) => {
      const key = line.truck ? `TRUCK:${line.truck.id}` : line.trailer ? `TRAILER:${line.trailer.id}` : ''
      const account = assetLabels[key] || (line.truck
        ? `${line.truck.licensePlate} · ${line.truck.make} ${line.truck.model} (${line.truck.year})`
        : `Trailer ${line.trailer?.number || ''}`)
      return {
        date: invoice.invoiceDate,
        invoiceNumber: invoice.internalNumber,
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        vendor: invoice.vendor.name,
        account,
        description: `${categoryLabels[line.category] || 'Expense'} · ${line.description}`,
        debit: Number(line.netAmount || 0),
        credit: 0,
        status: invoice.status,
      }
    })
    const vat = lines.reduce((sum: number, line: any) => sum + Number(line.vatAmount || 0), 0)
    if (vat > 0) entries.push({
      date: invoice.invoiceDate, invoiceNumber: invoice.internalNumber, vendorInvoiceNumber: invoice.vendorInvoiceNumber,
      vendor: invoice.vendor.name, account: 'Input VAT · Tax Authority', description: `Input VAT · ${invoice.internalNumber}`,
      debit: vat, credit: 0, status: invoice.status,
    })
    entries.push({
      date: invoice.invoiceDate, invoiceNumber: invoice.internalNumber, vendorInvoiceNumber: invoice.vendorInvoiceNumber,
      vendor: invoice.vendor.name, account: `Vendor payable · ${invoice.vendor.name}`,
      description: `Supplier payable · ${invoice.internalNumber}`, debit: 0,
      credit: lines.reduce((sum: number, line: any) => sum + Number(line.totalAmount || 0), 0), status: invoice.status,
    })
    return entries
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function dateLabel(value: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' })
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
}

export function renderPurchaseInvoiceReportDocument(input: {
  company: PurchaseInvoiceReportCompany | null
  entries: PurchaseInvoiceReportEntry[]
  assets: string[]
  period: string
  statusLabel: string
  invoiceCount: number
  expenseTotal: number
  vatTotal: number
  payableTotal: number
  generatedAt: string
  shareUrl: string
  qrDataUrl: string
}) {
  const rowsPerPage = 8
  const pages = Array.from({ length: Math.max(1, Math.ceil(input.entries.length / rowsPerPage)) }, (_, index) => input.entries.slice(index * rowsPerPage, (index + 1) * rowsPerPage))
  const companyName = escapeHtml(input.company?.companyName || 'Fleet Manager')
  const companyDetails = [input.company?.companyAddress, input.company?.companyPhone, input.company?.companyEmail].filter(Boolean).map(escapeHtml).join(' · ')
  const assetsLabel = input.assets.map(escapeHtml).join(', ')
  const safeShareUrl = escapeHtml(input.shareUrl)
  const reportPages = pages.map((entries, pageIndex) => {
    const tableRows = entries.map((entry) => `<tr class="${entry.status === 'VOID' ? 'reversed' : ''}">
      <td class="date">${dateLabel(entry.date)}</td>
      <td><strong>${escapeHtml(entry.invoiceNumber)}</strong>${entry.vendorInvoiceNumber ? `<small>Supplier ref: ${escapeHtml(entry.vendorInvoiceNumber)}</small>` : ''}<small>${escapeHtml(entry.vendor)}</small></td>
      <td>${escapeHtml(entry.account)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td class="amount">${entry.debit ? money(entry.debit) : '—'}</td>
      <td class="amount">${entry.credit ? money(entry.credit) : '—'}</td>
      <td><span class="status ${entry.status === 'VOID' ? 'void' : ''}">${entry.status === 'VOID' ? 'REVERSED' : 'POSTED'}</span></td>
    </tr>`).join('')

    return `<section class="print-page">
      <header class="brand-header"><div class="brand-mark">FM</div><div class="brand-copy"><h1>${companyName}</h1><p>FLEET FINANCE · ACCOUNTS PAYABLE</p>${companyDetails ? `<div class="company-details">${companyDetails}</div>` : ''}</div><div class="document-title"><span>VEHICLE REPORT</span><strong>Purchase invoices</strong></div></header>
      <div class="title-row"><div class="title-copy"><p class="eyebrow">FLEET EXPENSES · INPUT VAT · VENDOR PAYABLES</p><h2>Vehicle purchase invoice report</h2><p class="subtitle">Journal detail for the selected fleet accounts</p></div><div class="report-stamp"><div class="report-number"><span>GENERATED</span><strong>${escapeHtml(input.generatedAt)}</strong><small>Page ${pageIndex + 1} of ${pages.length}</small></div><div class="scan-block"><img src="${input.qrDataUrl}" alt="Scan to view this report online"/><small>Scan to view</small></div></div></div>
      <div class="filter-strip"><div><span>REPORTING PERIOD</span><strong>${escapeHtml(input.period)}</strong></div><div><span>SELECTED TRUCKS & TRAILERS</span><strong>${assetsLabel}</strong></div><div><span>INVOICE STATUS</span><strong>${escapeHtml(input.statusLabel)}</strong></div></div>
      ${pageIndex === 0 ? `<div class="summary-grid"><div><span>Matching invoices</span><strong>${input.invoiceCount.toLocaleString()}</strong></div><div><span>Vehicle expense · debit</span><strong>${money(input.expenseTotal)}</strong></div><div><span>Input VAT · debit</span><strong>${money(input.vatTotal)}</strong></div><div class="payable"><span>Vendor payable · credit</span><strong>${money(input.payableTotal)}</strong></div></div>` : ''}
      <div class="table-title"><h3>Journal entry detail</h3><span>${input.entries.length.toLocaleString()} journal lines · SAR</span></div>
      <table class="journal-table"><thead><tr><th>Date</th><th>Invoice / Vendor</th><th>Fleet account</th><th>Expense detail</th><th class="amount">Debit</th><th class="amount">Credit</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
      <footer><span>${companyName} · Generated from purchase invoice records</span><span>Debits and credits balance per included invoice. Reversed entries are retained for audit.</span><a href="${safeShareUrl}">Open online report</a></footer>
    </section>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Vehicle purchase invoice report</title><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9edf2;color:#172536;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-page{position:relative;width:794px;height:1123px;margin:18px auto;padding:34px 38px;background:#fff;overflow:hidden;box-shadow:0 12px 36px rgba(15,35,55,.16);font-size:11px}.brand-header{height:72px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #0d6b65;padding-bottom:10px}.brand-mark{width:42px;height:42px;flex:none;border-radius:12px;background:#0d625f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800}.brand-copy{flex:1;min-width:0}.brand-copy h1{margin:0;color:#12343b;font-size:17px}.brand-copy>p{margin:4px 0 0;color:#71818e;font-size:7px;font-weight:700;letter-spacing:1.2px}.company-details{margin-top:5px;color:#657482;font-size:8px}.document-title{text-align:right;color:#0d625f}.document-title span,.report-number span{display:block;font-size:7px;letter-spacing:1px;font-weight:700;color:#738390}.document-title strong{display:block;margin-top:5px;font-size:12px}.title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:17px 0 12px}.title-copy{min-width:0}.eyebrow{margin:0 0 5px;color:#0d7970;font-size:7px;font-weight:700;letter-spacing:1.1px}.title-row h2{margin:0;color:#162c3a;font-size:18px}.subtitle{margin:4px 0 0;color:#77838f;font-size:9px}.report-stamp{display:flex;align-items:center;gap:8px;flex:none}.report-number{min-width:114px;border:1px solid #dce5e8;border-radius:8px;padding:8px;background:#f7faf9}.report-number strong{display:block;margin:4px 0;color:#075e58;font-size:9px}.report-number small{color:#76848e;font-size:7px}.scan-block{display:flex;flex-direction:column;align-items:center;gap:2px;width:96px;color:#526d73;font-size:6px;text-align:center}.scan-block img{display:block;width:88px;height:88px;object-fit:contain}.filter-strip{display:grid;grid-template-columns:.9fr 2.1fr .9fr;gap:7px;margin-bottom:11px}.filter-strip>div{min-width:0;border:1px solid #e1e7e9;border-radius:7px;background:#fbfcfc;padding:8px}.filter-strip span{display:block;color:#84919a;font-size:6px;font-weight:700;letter-spacing:.65px}.filter-strip strong{display:block;margin-top:4px;color:#293e49;font-size:8px;line-height:1.35;overflow-wrap:anywhere}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:12px}.summary-grid>div{border:1px solid #e0e7e8;border-radius:8px;background:#f8fafb;padding:9px 11px}.summary-grid span{display:block;color:#71808b;font-size:7px}.summary-grid strong{display:block;margin-top:4px;color:#1e3945;font-size:10px;font-variant-numeric:tabular-nums}.summary-grid .payable{background:#0f625d;border-color:#0f625d}.summary-grid .payable span,.summary-grid .payable strong{color:#fff}.table-title{display:flex;align-items:center;justify-content:space-between;margin:9px 0 6px}.table-title h3{margin:0;color:#1d3440;font-size:10px}.table-title span{color:#71808b;font-size:7px}.journal-table{width:100%;border-collapse:collapse;table-layout:fixed}.journal-table th{padding:7px 5px;background:#123f47;color:#fff;text-align:left;font-size:6.3px;letter-spacing:.15px}.journal-table th:nth-child(1){width:9%}.journal-table th:nth-child(2){width:18%}.journal-table th:nth-child(3){width:19%}.journal-table th:nth-child(4){width:24%}.journal-table th:nth-child(5),.journal-table th:nth-child(6){width:11%}.journal-table th:nth-child(7){width:8%}.journal-table td{padding:7px 5px;border-bottom:1px solid #e7ecee;vertical-align:top;color:#50616d;font-size:7px;line-height:1.35;overflow-wrap:anywhere}.journal-table tbody tr:nth-child(even){background:#f8fafb}.journal-table td strong{display:block;color:#263b47;font-size:7.2px}.journal-table td small{display:block;margin-top:3px;color:#89949c;font-size:6px;line-height:1.25}.journal-table .date{white-space:nowrap}.amount{text-align:right!important;white-space:nowrap;font-variant-numeric:tabular-nums}.status{display:inline-block;border-radius:10px;background:#e6f5ef;padding:3px 5px;color:#13724d;font-size:5.5px;font-weight:700;white-space:nowrap}.status.void{background:#fff0e6;color:#a94e20}.reversed td{color:#8b7770}footer{position:absolute;left:38px;right:38px;bottom:18px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-top:1px solid #e3e9eb;padding-top:7px;color:#77858e;font-size:6px;line-height:1.35}footer span:first-child{flex:0 0 32%}footer span:nth-child(2){flex:1;text-align:center}footer a{flex:0 0 auto;color:#0d625f;text-decoration:none}@media screen and (max-width:820px){.print-page{width:calc(100vw - 20px);height:auto;min-height:calc((100vw - 20px)*1.414);aspect-ratio:794/1123;margin:8px auto;padding:4.2vw 4.7vw}.brand-header{height:9%;gap:1.5%;padding-bottom:1.3%}.brand-mark{width:5.3%;height:auto;aspect-ratio:1;border-radius:24%;font-size:clamp(8px,1.8vw,15px)}.brand-copy h1{font-size:clamp(10px,2vw,17px)}.brand-copy>p,.document-title span,.report-number span,.eyebrow{font-size:clamp(5px,.85vw,7px)}.company-details{font-size:clamp(5px,1vw,8px)}.document-title strong{font-size:clamp(8px,1.5vw,12px)}.title-row{margin:2.1% 0 1.5%}.title-row h2{font-size:clamp(12px,2.2vw,18px)}.subtitle{font-size:clamp(6px,1.1vw,9px)}.report-number{min-width:15%;padding:1.1%}.report-number strong{font-size:clamp(6px,1.1vw,9px)}.report-number small{font-size:clamp(5px,.8vw,7px)}.scan-block{width:13%}.scan-block img{width:12vw;height:12vw;max-width:88px;max-height:88px}.filter-strip{gap:.8%;margin-bottom:1.5%}.filter-strip>div{padding:1%}.filter-strip span{font-size:clamp(4px,.75vw,6px)}.filter-strip strong{font-size:clamp(5px,.95vw,8px)}.summary-grid{gap:.8%;margin-bottom:1.5%}.summary-grid>div{padding:1.1% 1.4%}.summary-grid span{font-size:clamp(5px,.8vw,7px)}.summary-grid strong{font-size:clamp(7px,1.3vw,10px);margin-top:2%}.table-title{margin:1.1% 0 .8%}.table-title h3{font-size:clamp(7px,1.3vw,10px)}.table-title span{font-size:clamp(5px,.9vw,7px)}.journal-table th{padding:.7%;font-size:clamp(4px,.78vw,6.3px)}.journal-table td{padding:.65%;font-size:clamp(5px,.88vw,7px)}.journal-table td strong{font-size:clamp(5px,.91vw,7.2px)}.journal-table td small{font-size:clamp(4px,.76vw,6px)}.status{font-size:clamp(4px,.7vw,5.5px);padding:2px 3px}footer{left:4.7%;right:4.7%;bottom:2%;padding-top:.7%;font-size:clamp(4px,.75vw,6px)}}@media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;margin:0!important;padding:0!important;background:#fff!important}.print-page{width:210mm;height:297mm;margin:0;padding:9mm 10mm;box-shadow:none;break-after:page;page-break-after:always;overflow:hidden}.print-page:last-child{break-after:auto;page-break-after:auto}}
  </style></head><body>${reportPages}</body></html>`
}
