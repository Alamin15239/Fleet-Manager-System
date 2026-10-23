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
}) {
  const rowsPerPage = 15
  const pages = Array.from({ length: Math.max(1, Math.ceil(input.entries.length / rowsPerPage)) }, (_, index) => input.entries.slice(index * rowsPerPage, (index + 1) * rowsPerPage))
  const companyName = escapeHtml(input.company?.companyName || 'Fleet Manager')
  const companyDetails = [input.company?.companyAddress, input.company?.companyPhone, input.company?.companyEmail].filter(Boolean).map(escapeHtml).join(' · ')
  const assetsLabel = input.assets.map(escapeHtml).join(', ')
  const reportPages = pages.map((entries, pageIndex) => {
    const tableRows = entries.map((entry) => `<tr class="${entry.status === 'VOID' ? 'reversed' : ''}">
      <td class="date">${dateLabel(entry.date)}</td>
      <td><strong>${escapeHtml(entry.invoiceNumber)}</strong>${entry.vendorInvoiceNumber ? `<small>Supplier ref: ${escapeHtml(entry.vendorInvoiceNumber)}</small>` : ''}</td>
      <td>${escapeHtml(entry.vendor)}</td>
      <td>${escapeHtml(entry.account)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td class="amount">${entry.debit ? money(entry.debit) : '—'}</td>
      <td class="amount">${entry.credit ? money(entry.credit) : '—'}</td>
      <td><span class="status ${entry.status === 'VOID' ? 'void' : ''}">${entry.status === 'VOID' ? 'REVERSED · EXCLUDED' : 'POSTED'}</span></td>
    </tr>`).join('')

    return `<section class="print-page">
      <header class="brand-header"><div class="brand-mark">FM</div><div class="brand-copy"><h1>${companyName}</h1><p>FLEET FINANCE · ACCOUNTS PAYABLE</p>${companyDetails ? `<div class="company-details">${companyDetails}</div>` : ''}</div><div class="document-title"><span>FINANCIAL REPORT</span><strong>Purchase invoices</strong></div></header>
      <div class="title-row"><div><p class="eyebrow">VEHICLE EXPENSES · INPUT VAT · VENDOR PAYABLES</p><h2>Vehicle purchase invoice report</h2><p class="subtitle">Journal-style detail for the selected fleet accounts</p></div><div class="report-number"><span>GENERATED</span><strong>${escapeHtml(input.generatedAt)}</strong><small>Page ${pageIndex + 1} of ${pages.length}</small></div></div>
      <div class="filter-strip"><div><span>REPORTING PERIOD</span><strong>${escapeHtml(input.period)}</strong></div><div><span>SELECTED ASSETS</span><strong>${assetsLabel}</strong></div><div><span>INVOICE STATUS</span><strong>${escapeHtml(input.statusLabel)}</strong></div></div>
      ${pageIndex === 0 ? `<div class="summary-grid"><div><span>Matching invoices</span><strong>${input.invoiceCount.toLocaleString()}</strong></div><div><span>Vehicle expense · debit</span><strong>${money(input.expenseTotal)}</strong></div><div><span>Input VAT · debit</span><strong>${money(input.vatTotal)}</strong></div><div class="payable"><span>Vendor payable · credit</span><strong>${money(input.payableTotal)}</strong></div></div>` : ''}
      <div class="table-title"><h3>Journal entry detail</h3><span>${input.entries.length.toLocaleString()} journal lines · SAR</span></div>
      <table class="journal-table"><thead><tr><th>Date</th><th>Invoice no.</th><th>Vendor</th><th>Account</th><th>Description</th><th class="amount">Debit</th><th class="amount">Credit</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
      <footer><span>${companyName} · Generated from posted purchase invoice records</span><span>Debits and credits balance for each included invoice. Reversed entries are shown for audit and excluded from totals.</span></footer>
    </section>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Vehicle purchase invoice report</title><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9edf2;color:#172536;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-page{position:relative;width:1123px;height:794px;margin:18px auto;padding:35px 42px;background:#fff;overflow:hidden;box-shadow:0 12px 36px rgba(15,35,55,.16);font-size:11px}.brand-header{height:78px;display:flex;align-items:center;gap:13px;border-bottom:2px solid #0d6b65;padding-bottom:11px}.brand-mark{width:43px;height:43px;border-radius:12px;background:#0d625f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800}.brand-copy{flex:1;min-width:0}.brand-copy h1{margin:0;color:#12343b;font-size:17px}.brand-copy>p{margin:4px 0 0;color:#71818e;font-size:7px;font-weight:700;letter-spacing:1.2px}.company-details{margin-top:5px;color:#657482;font-size:8px}.document-title{text-align:right;color:#0d625f}.document-title span,.report-number span{display:block;font-size:7px;letter-spacing:1px;font-weight:700;color:#738390}.document-title strong{display:block;margin-top:5px;font-size:13px}.title-row{display:flex;align-items:center;justify-content:space-between;margin:15px 0 12px}.eyebrow{margin:0 0 4px;color:#0d7970;font-size:7px;font-weight:700;letter-spacing:1.1px}.title-row h2{margin:0;color:#162c3a;font-size:19px}.subtitle{margin:4px 0 0;color:#77838f;font-size:9px}.report-number{min-width:135px;border:1px solid #dce5e8;border-radius:8px;padding:8px 10px;background:#f7faf9}.report-number strong{display:block;margin:4px 0;color:#075e58;font-size:10px}.report-number small{color:#76848e;font-size:7px}.filter-strip{display:grid;grid-template-columns:.8fr 2.3fr .8fr;gap:8px;margin-bottom:11px}.filter-strip>div{min-width:0;border:1px solid #e1e7e9;border-radius:7px;background:#fbfcfc;padding:7px 9px}.filter-strip span{display:block;color:#84919a;font-size:6px;font-weight:700;letter-spacing:.65px}.filter-strip strong{display:block;margin-top:4px;color:#293e49;font-size:8px;line-height:1.3;overflow-wrap:anywhere}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:13px}.summary-grid>div{border:1px solid #e0e7e8;border-radius:8px;background:#f8fafb;padding:8px 10px}.summary-grid span{display:block;color:#71808b;font-size:7px}.summary-grid strong{display:block;margin-top:5px;color:#1e3945;font-size:11px;font-variant-numeric:tabular-nums}.summary-grid .payable{background:#0f625d;border-color:#0f625d}.summary-grid .payable span,.summary-grid .payable strong{color:#fff}.table-title{display:flex;align-items:center;justify-content:space-between;margin:9px 0 6px}.table-title h3{margin:0;color:#1d3440;font-size:10px}.table-title span{color:#71808b;font-size:7px}.journal-table{width:100%;border-collapse:collapse;table-layout:fixed}.journal-table th{padding:7px 6px;background:#123f47;color:#fff;text-align:left;font-size:6.5px;letter-spacing:.25px}.journal-table th:nth-child(1){width:8%}.journal-table th:nth-child(2){width:10%}.journal-table th:nth-child(3){width:14%}.journal-table th:nth-child(4){width:14%}.journal-table th:nth-child(5){width:25%}.journal-table th:nth-child(6),.journal-table th:nth-child(7){width:11%}.journal-table th:nth-child(8){width:7%}.journal-table td{padding:6px;border-bottom:1px solid #e7ecee;vertical-align:top;color:#50616d;font-size:7.3px;line-height:1.3;overflow-wrap:anywhere}.journal-table tbody tr:nth-child(even){background:#f8fafb}.journal-table td strong{display:block;color:#263b47;font-size:7.4px}.journal-table td small{display:block;margin-top:2px;color:#89949c;font-size:6px}.journal-table .date{white-space:nowrap}.amount{text-align:right!important;white-space:nowrap;font-variant-numeric:tabular-nums}.status{display:inline-block;border-radius:10px;background:#e6f5ef;padding:3px 5px;color:#13724d;font-size:5.5px;font-weight:700;white-space:nowrap}.status.void{background:#fff0e6;color:#a94e20}.reversed td{color:#8b7770}footer{position:absolute;left:42px;right:42px;bottom:17px;display:flex;justify-content:space-between;gap:18px;border-top:1px solid #e3e9eb;padding-top:7px;color:#77858e;font-size:6.5px}footer span:first-child{flex:0 0 35%}footer span:last-child{text-align:right}@media screen and (max-width:1160px){.print-page{width:calc(100vw - 24px);height:auto;min-height:0;aspect-ratio:1123/794;margin:8px auto;padding:3.1vw 3.75vw}.brand-header{height:9.8%;gap:1.2%;padding-bottom:1.3%}.brand-mark{width:4.1%;height:auto;aspect-ratio:1;border-radius:24%;font-size:clamp(8px,1.4vw,16px)}.brand-copy h1{font-size:clamp(10px,1.5vw,17px)}.brand-copy>p{font-size:clamp(5px,.65vw,7px)}.company-details{font-size:clamp(5px,.75vw,8px)}.document-title span,.report-number span{font-size:clamp(5px,.65vw,7px)}.document-title strong{font-size:clamp(8px,1.15vw,13px)}.title-row{margin:1.8% 0 1.5%}.eyebrow{font-size:clamp(5px,.65vw,7px)}.title-row h2{font-size:clamp(12px,1.7vw,19px)}.subtitle{font-size:clamp(6px,.8vw,9px)}.report-number{min-width:15%;padding:1%}.report-number strong{font-size:clamp(7px,.9vw,10px)}.report-number small{font-size:clamp(5px,.6vw,7px)}.filter-strip{gap:.7%;margin-bottom:1.3%}.filter-strip>div{padding:.7% .9%}.filter-strip span{font-size:clamp(4px,.55vw,6px)}.filter-strip strong{font-size:clamp(5px,.7vw,8px)}.summary-grid{gap:.7%;margin-bottom:1.5%}.summary-grid>div{padding:.8% 1%}.summary-grid span{font-size:clamp(5px,.6vw,7px)}.summary-grid strong{font-size:clamp(7px,1vw,11px);margin-top:2%}.table-title{margin:1% 0 .6%}.table-title h3{font-size:clamp(7px,.9vw,10px)}.table-title span{font-size:clamp(5px,.6vw,7px)}.journal-table th{padding:.55%;font-size:clamp(4px,.58vw,6.5px)}.journal-table td{padding:.45%;font-size:clamp(5px,.65vw,7.3px)}.journal-table td strong{font-size:clamp(5px,.66vw,7.4px)}.journal-table td small{font-size:clamp(4px,.53vw,6px)}.status{font-size:clamp(4px,.49vw,5.5px);padding:2px 3px}footer{left:3.75%;right:3.75%;bottom:2.1%;padding-top:.65%;font-size:clamp(4px,.58vw,6.5px)}}@media print{@page{size:A4 landscape;margin:0}html,body{width:297mm;margin:0!important;padding:0!important;background:#fff!important}.print-page{width:297mm;height:210mm;margin:0;padding:9.25mm 11.1mm;box-shadow:none;break-after:page;page-break-after:always;overflow:hidden}.print-page:last-child{break-after:auto;page-break-after:auto}}
  </style></head><body>${reportPages}</body></html>`
}
