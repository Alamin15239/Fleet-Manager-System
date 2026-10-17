export interface PurchaseInvoiceDocumentData {
  internalNumber: string
  vendorInvoiceNumber?: string | null
  invoiceDate: string
  dueDate?: string | null
  isVatInvoice: boolean
  pricesIncludeVat: boolean
  vatRate: number
  subtotal: number
  vatTotal: number
  grandTotal: number
  status: 'POSTED' | 'VOID'
  notes?: string | null
  vendor: { name: string; vatRegistration?: string | null; phone?: string | null; email?: string | null; address?: string | null }
  lines: Array<{
    category: string
    description: string
    quantity: number
    unitPrice: number
    netAmount: number
    vatAmount: number
    totalAmount: number
    truck?: { licensePlate: string; make?: string | null; model?: string | null } | null
    trailer?: { number: string } | null
  }>
}

export interface PurchaseInvoiceCompany {
  companyName?: string | null
  companyAddress?: string | null
  companyPhone?: string | null
  companyEmail?: string | null
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
}

function date(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' })
}

function vehicle(line: PurchaseInvoiceDocumentData['lines'][number]) {
  if (line.truck) return `Truck ${line.truck.licensePlate}${line.truck.make || line.truck.model ? ` · ${[line.truck.make, line.truck.model].filter(Boolean).join(' ')}` : ''}`
  return line.trailer ? `Trailer ${line.trailer.number}` : '—'
}

export function renderPurchaseInvoiceDocument(invoice: PurchaseInvoiceDocumentData, company: PurchaseInvoiceCompany | null, shareUrl: string, qrDataUrl: string) {
  const pageSize = 8
  const pages = Array.from({ length: Math.max(1, Math.ceil(invoice.lines.length / pageSize)) }, (_, index) => invoice.lines.slice(index * pageSize, (index + 1) * pageSize))
  const companyName = company?.companyName || 'Saadfreeh Transport Est.'
  const companyDetails = [company?.companyAddress, company?.companyPhone, company?.companyEmail].filter(Boolean).map(escapeHtml).join(' <span>·</span> ')
  const statusLabel = invoice.status === 'VOID' ? 'REVERSED' : 'POSTED'
  const invoiceLines = (lines: PurchaseInvoiceDocumentData['lines']) => lines.map((line) => `
    <tr>
      <td><span class="category">${escapeHtml(line.category.replaceAll('_', ' '))}</span><strong>${escapeHtml(line.description)}</strong></td>
      <td>${escapeHtml(vehicle(line))}</td>
      <td class="num">${escapeHtml(line.quantity)}</td>
      <td class="num">${money(line.unitPrice)}</td>
      <td class="num">${money(line.netAmount)}</td>
    </tr>`).join('')

  const documentPages = pages.map((lines, index) => {
    const isLastPage = index === pages.length - 1
    return `<section class="print-page">
      <header class="brand-header">
        <div class="brand-mark">SF</div>
        <div class="brand-copy"><h1>${escapeHtml(companyName)}</h1><p>FLEET · WORKSHOP · PROCUREMENT</p>${companyDetails ? `<div class="company-details">${companyDetails}</div>` : ''}</div>
        <div class="document-title"><span>PURCHASE DOCUMENT</span><strong>فاتورة مشتريات</strong></div>
      </header>
      <div class="title-row"><div><p class="eyebrow">ACCOUNTING · ${escapeHtml(statusLabel)}</p><h2>Purchase invoice</h2><p class="subtitle">${index > 0 ? 'Invoice details · continued' : 'Supplier expense and VAT record'}</p></div><div class="invoice-number"><span>INVOICE NO.</span><strong>${escapeHtml(invoice.internalNumber)}</strong><small>${index + 1} / ${pages.length}</small></div></div>
      ${index === 0 ? `<div class="parties-grid">
        <section class="info-card vendor-card"><p class="card-label">SUPPLIER / VENDOR <span>المورّد</span></p><h3>${escapeHtml(invoice.vendor.name)}</h3>${invoice.vendor.address ? `<p>${escapeHtml(invoice.vendor.address)}</p>` : ''}<div class="vendor-meta">${invoice.vendor.vatRegistration ? `<span>VAT ${escapeHtml(invoice.vendor.vatRegistration)}</span>` : ''}${invoice.vendor.phone ? `<span>${escapeHtml(invoice.vendor.phone)}</span>` : ''}${invoice.vendor.email ? `<span>${escapeHtml(invoice.vendor.email)}</span>` : ''}</div></section>
        <section class="info-card date-card"><div class="date-field"><span>INVOICE DATE</span><strong>${date(invoice.invoiceDate)}</strong></div><div class="date-field"><span>DUE DATE</span><strong>${date(invoice.dueDate)}</strong></div><div class="date-field"><span>SUPPLIER INVOICE NO.</span><strong>${escapeHtml(invoice.vendorInvoiceNumber || '—')}</strong></div></section>
      </div>` : `<div class="continuation-note">Invoice ${escapeHtml(invoice.internalNumber)} · Supplier: ${escapeHtml(invoice.vendor.name)} · Date: ${date(invoice.invoiceDate)}</div>`}
      <div class="table-title"><h3>Expense details <span>تفاصيل المصروفات</span></h3><span>${invoice.lines.length} line${invoice.lines.length === 1 ? '' : 's'}</span></div>
      <table class="lines-table"><thead><tr><th>DESCRIPTION / CATEGORY</th><th>FLEET ASSET</th><th class="num">QTY</th><th class="num">UNIT PRICE</th><th class="num">NET AMOUNT</th></tr></thead><tbody>${invoiceLines(lines)}</tbody></table>
      ${isLastPage ? `<div class="closing-grid"><div class="notes-box"><span>NOTES / ملاحظات</span><p>${escapeHtml(invoice.notes || 'No additional notes.')}</p><div class="tax-treatment">Tax treatment: ${invoice.isVatInvoice ? `${escapeHtml(invoice.vatRate)}% VAT · ${invoice.pricesIncludeVat ? 'prices VAT-inclusive' : 'VAT added to prices'}` : 'No VAT'}</div></div><div class="totals-box"><div><span>Subtotal (excl. VAT)</span><strong>${money(invoice.subtotal)}</strong></div><div><span>Input VAT · ${invoice.isVatInvoice ? `${escapeHtml(invoice.vatRate)}%` : '0%'}</span><strong>${money(invoice.vatTotal)}</strong></div><div class="grand-total"><span>TOTAL PAYABLE</span><strong>${money(invoice.grandTotal)}</strong></div><small>Amounts shown in Saudi Riyals (SAR)</small></div></div>` : `<div class="continuation-total">Continued on page ${index + 2} →</div>`}
      <footer class="invoice-footer">
        <div class="footer-copy"><strong>${escapeHtml(companyName)}</strong><span>Computer-generated purchase invoice</span><span>${escapeHtml(shareUrl)}</span></div>
        <div class="scan-block"><img src="${escapeHtml(qrDataUrl)}" alt="QR code linking to invoice" /><span>SCAN TO VIEW<br/>OR DOWNLOAD</span></div>
        <div class="footer-page">${index + 1}<span> / ${pages.length}</span></div>
      </footer>
    </section>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(invoice.internalNumber)} · Purchase invoice</title><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9edf2;color:#172536;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-page{position:relative;width:794px;height:1123px;margin:18px auto;padding:43px 48px;background:#fff;overflow:hidden;box-shadow:0 12px 36px rgba(15,35,55,.16);font-size:12px}.brand-header{height:105px;display:flex;align-items:center;gap:15px;border-bottom:2px solid #0d6b65;padding-bottom:16px}.brand-mark{width:54px;height:54px;border-radius:14px;background:#0d625f;color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;letter-spacing:-1px}.brand-copy{flex:1;min-width:0}.brand-copy h1{margin:0;color:#12343b;font-size:19px;letter-spacing:.2px}.brand-copy>p{margin:5px 0 0;color:#71818e;font-size:8px;font-weight:700;letter-spacing:1.45px}.company-details{margin-top:7px;color:#657482;font-size:9px;line-height:1.4}.company-details span{color:#c0c8ce;padding:0 4px}.document-title{text-align:right;color:#0d625f}.document-title span{display:block;font-size:8px;letter-spacing:1.3px;font-weight:700;color:#738390}.document-title strong{display:block;margin-top:6px;font-size:16px}.title-row{display:flex;align-items:center;justify-content:space-between;margin:23px 0 18px}.eyebrow{margin:0 0 5px;color:#0d7970;font-size:8px;font-weight:700;letter-spacing:1.5px}.title-row h2{margin:0;font-size:24px;letter-spacing:-.5px;color:#162c3a}.subtitle{margin:5px 0 0;color:#77838f;font-size:10px}.invoice-number{min-width:177px;border:1px solid #dce5e8;border-radius:9px;padding:11px 13px;background:#f7faf9}.invoice-number span,.invoice-number small{display:block;color:#76848e;font-size:8px;font-weight:700;letter-spacing:1px}.invoice-number strong{display:block;margin:5px 0;color:#075e58;font-size:15px;letter-spacing:.3px}.invoice-number small{font-weight:400;letter-spacing:0}.parties-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;margin-bottom:23px}.info-card{min-height:112px;border:1px solid #e1e7e9;border-radius:9px;padding:13px 14px}.vendor-card{background:linear-gradient(135deg,#f7fbfa,#fff)}.card-label{margin:0;color:#62737e;font-size:8px;font-weight:700;letter-spacing:.9px}.card-label span{margin-left:6px;color:#87949c;font-weight:400;letter-spacing:0}.info-card h3{margin:10px 0 4px;font-size:15px;color:#203440}.info-card>p:not(.card-label){margin:4px 0;color:#6f7e88;font-size:9px;line-height:1.4}.vendor-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;color:#64737d;font-size:8px}.date-card{display:grid;grid-template-columns:1fr 1fr;gap:10px 8px}.date-field span{display:block;color:#86929b;font-size:7px;font-weight:700;letter-spacing:.65px}.date-field strong{display:block;margin-top:5px;color:#263b47;font-size:10px}.table-title{display:flex;align-items:center;justify-content:space-between;margin:20px 0 9px}.table-title h3{margin:0;color:#1d3440;font-size:12px}.table-title h3 span{margin-left:5px;color:#87949c;font-size:9px;font-weight:400}.table-title>span{color:#71808b;font-size:9px}.lines-table{width:100%;border-collapse:collapse;table-layout:fixed}.lines-table th{padding:9px 7px;background:#123f47;color:white;text-align:left;font-size:7px;letter-spacing:.55px}.lines-table th:first-child{width:38%}.lines-table th:nth-child(2){width:24%}.lines-table th:nth-child(3){width:7%}.lines-table th:nth-child(4){width:15%}.lines-table th:nth-child(5){width:16%}.lines-table td{padding:9px 7px;border-bottom:1px solid #e7ecee;vertical-align:top;color:#50616d;font-size:9px;line-height:1.45;overflow-wrap:anywhere}.lines-table tbody tr:nth-child(even){background:#f8fafb}.lines-table td strong{display:block;color:#263b47;font-size:9px}.category{display:inline-block;margin-bottom:3px;color:#0c7770;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.45px}.num{text-align:right!important;white-space:nowrap;font-variant-numeric:tabular-nums}.closing-grid{display:grid;grid-template-columns:1fr 245px;gap:18px;margin-top:18px}.notes-box{border:1px solid #e2e8ea;border-radius:8px;padding:12px}.notes-box>span{color:#7b8992;font-size:7px;font-weight:700;letter-spacing:.9px}.notes-box p{margin:9px 0 17px;color:#4c5d68;font-size:9px;line-height:1.5}.tax-treatment{border-top:1px solid #e8edef;padding-top:8px;color:#73818b;font-size:8px}.totals-box{border:1px solid #e0e7e8;border-radius:8px;padding:11px 12px;background:#fbfcfc}.totals-box>div{display:flex;justify-content:space-between;gap:8px;padding:5px 0;color:#64727c;font-size:9px}.totals-box>div strong{color:#263c46;white-space:nowrap;font-variant-numeric:tabular-nums}.totals-box .grand-total{margin-top:5px;border-top:1px solid #dce4e6;padding-top:10px;color:#fff}.grand-total span,.grand-total strong{color:#fff!important}.totals-box .grand-total{margin-left:-12px;margin-right:-12px;margin-bottom:-2px;padding:10px 12px;background:#0f625d}.totals-box>small{display:block;padding-top:8px;color:#8a969e;font-size:7px;text-align:right}.continuation-note{margin:13px 0 20px;border:1px solid #e3e9eb;border-radius:7px;background:#f8fafb;padding:11px;color:#65747d;font-size:9px}.continuation-total{margin-top:17px;color:#6f7d86;font-size:9px;text-align:right}.invoice-footer{position:absolute;left:48px;right:48px;bottom:30px;min-height:61px;display:flex;align-items:flex-end;gap:12px;border-top:1px solid #e3e9eb;padding-top:11px}.footer-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px;color:#77858e;font-size:7px}.footer-copy strong{color:#35505b;font-size:8px}.footer-copy span:last-child{overflow-wrap:anywhere}.scan-block{display:flex;align-items:center;gap:7px;padding:4px 7px;border:1px solid #e2e8e9;border-radius:7px}.scan-block img{width:50px;height:50px;object-fit:contain}.scan-block span{color:#4d626d;font-size:7px;font-weight:700;line-height:1.45;letter-spacing:.25px}.footer-page{width:25px;padding-bottom:4px;color:#0d625f;font-size:10px;font-weight:700;text-align:right}.footer-page span{color:#89969e;font-weight:400}@media screen and (max-width:820px){html,body{background:#e9edf2}.print-page{width:calc(100vw - 16px);height:auto;min-height:0;aspect-ratio:794/1123;margin:8px auto;padding:5.4vw 6vw;overflow:hidden;font-size:clamp(6px,1.5vw,12px)}.brand-header{height:9.3%;gap:2%;padding-bottom:1.4%}.brand-mark{width:7%;height:auto;aspect-ratio:1;border-radius:20%;font-size:clamp(9px,2.5vw,20px)}.brand-copy h1{font-size:clamp(9px,2.4vw,19px)}.brand-copy>p{font-size:clamp(5px,1vw,8px)}.company-details{font-size:clamp(5px,1.1vw,9px);margin-top:1%}.document-title span{font-size:clamp(5px,1vw,8px)}.document-title strong{font-size:clamp(8px,2vw,16px);margin-top:2%}.title-row{margin:3% 0 2.4%}.eyebrow{font-size:clamp(5px,1vw,8px)}.title-row h2{font-size:clamp(13px,3vw,24px)}.subtitle{font-size:clamp(6px,1.25vw,10px)}.invoice-number{min-width:25%;padding:1.5% 2%}.invoice-number span,.invoice-number small{font-size:clamp(5px,.95vw,8px)}.invoice-number strong{font-size:clamp(8px,1.9vw,15px);margin:2% 0}.parties-grid{gap:1.5%;margin-bottom:2.5%}.info-card{min-height:0;padding:2%}.card-label{font-size:clamp(5px,1vw,8px)}.info-card h3{margin:2% 0 1%;font-size:clamp(8px,1.9vw,15px)}.info-card>p:not(.card-label){font-size:clamp(5px,1.1vw,9px)}.vendor-meta{gap:1% 3%;margin-top:1.5%;font-size:clamp(5px,1vw,8px)}.date-card{gap:2%}.date-field span{font-size:clamp(4px,.9vw,7px)}.date-field strong{font-size:clamp(6px,1.3vw,10px);margin-top:2%}.table-title{margin:2.4% 0 1%}.table-title h3{font-size:clamp(7px,1.5vw,12px)}.table-title h3 span,.table-title>span{font-size:clamp(5px,1.1vw,9px)}.lines-table th{padding:1.1% .9%;font-size:clamp(4px,.9vw,7px)}.lines-table td{padding:1.1% .9%;font-size:clamp(5px,1.1vw,9px);line-height:1.25}.lines-table td strong{font-size:clamp(5px,1.1vw,9px)}.category{font-size:clamp(4px,.9vw,7px)}.closing-grid{grid-template-columns:1fr 31%;gap:2.3%;margin-top:2.3%}.notes-box{padding:2%}.notes-box>span{font-size:clamp(4px,.9vw,7px)}.notes-box p{margin:2% 0 3%;font-size:clamp(5px,1.1vw,9px)}.tax-treatment{padding-top:2%;font-size:clamp(4px,.95vw,8px)}.totals-box{padding:1.7%}.totals-box>div{padding:1% 0;font-size:clamp(5px,1.1vw,9px)}.totals-box .grand-total{margin-left:-2%;margin-right:-2%;padding:2%}.totals-box>small{font-size:clamp(4px,.8vw,7px)}.continuation-note,.continuation-total{font-size:clamp(5px,1.1vw,9px)}.invoice-footer{left:6%;right:6%;bottom:2.6%;min-height:5.4%;gap:1.5%;padding-top:1%}.footer-copy{gap:3%;font-size:clamp(4px,.9vw,7px)}.footer-copy strong{font-size:clamp(5px,1vw,8px)}.scan-block{gap:1%;padding:.5% 1%}.scan-block img{width:6.2vw;height:6.2vw}.scan-block span{font-size:clamp(4px,.9vw,7px)}.footer-page{font-size:clamp(6px,1.3vw,10px)}}@media print{@page{size:A4 portrait;margin:0}html,body{width:210mm;margin:0!important;padding:0!important;background:white!important}.print-page{width:210mm;height:297mm;margin:0;padding:11.4mm 12.7mm;box-shadow:none;break-after:page;page-break-after:always;overflow:hidden}.print-page:last-child{break-after:auto;page-break-after:auto}}
  </style></head><body>${documentPages}</body></html>`
}
