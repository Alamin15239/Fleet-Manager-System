import QRCode from 'qrcode'

type Company = { companyName?: string | null; companyAddress?: string | null; companyPhone?: string | null; companyEmail?: string | null }

const checklistItems = [
  ['engineOil', 'Engine oil & filter', 'زيت المحرك والفلتر'], ['airFilter', 'Air filter', 'فلتر الهواء'],
  ['fuelFilter', 'Fuel filter', 'فلتر الوقود'], ['brakes', 'Brakes', 'المكابح'], ['tyres', 'Tyres & pressure', 'الإطارات والضغط'],
  ['battery', 'Battery', 'البطارية'], ['lights', 'Lights & signals', 'الأنوار والإشارات'], ['belts', 'Belts & hoses', 'السيور والخراطيم'],
  ['cooling', 'Cooling system', 'نظام التبريد'], ['transmission', 'Transmission oil', 'زيت ناقل الحركة']
]
const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => escapeMap[char] || char)

export async function renderJobCardDocument(card: any, company: Company | null, qrValue: string, origin: string) {
    const items = Array.isArray(card.items) ? card.items : []
    const checks = card.checklist || {}
    const truck = card.truck
    const plate = truck?.licensePlate || card.trailer?.number || ''
    const companyName = company?.companyName || 'Saadfreeh Transport Est.'
    const companyAddress = company?.companyAddress || 'Second Industrial Area, Kingdom of Saudi Arabia'
    const companyPhone = company?.companyPhone || '+966 5 766 24440'
    const companyEmail = company?.companyEmail || 'saad@saadfreeh.com'
    const printDateText = (value?: string | Date | null) => value
      ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
      : '—'
    const printNumber = (value?: number | string | null) => value == null || value === ''
      ? ''
      : Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : String(value)
    const printStatus = String(card.status || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
    const statusClass = String(card.status || 'open').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const completionEnglish = card.status === 'COMPLETED' ? 'Work listed above has been completed.' : card.status === 'IN_PROGRESS' ? 'Work is currently in progress.' : card.status === 'CANCELLED' ? 'This job card has been cancelled.' : 'Work is waiting to begin.'
    const completionArabic = card.status === 'COMPLETED' ? 'تم إنجاز الأعمال المذكورة أعلاه' : card.status === 'IN_PROGRESS' ? 'الأعمال قيد التنفيذ' : card.status === 'CANCELLED' ? 'تم إلغاء بطاقة العمل' : 'بانتظار بدء العمل'
    let qrDataUrl = ''
    try { qrDataUrl = await QRCode.toDataURL(qrValue, { width: 180, margin: 1, errorCorrectionLevel: 'M' }) }
    catch { throw new Error('Unable to generate the job card QR code') }

    const field = (label: string, arabic: string, value: unknown) => {
      const text = String(value ?? '').trim()
      return '<div class="field"><div class="field-label"><span>' + esc(label) + '</span><span dir="rtl">' + esc(arabic) + '</span></div><div class="field-value">' + (text ? esc(text) : '<span class="empty-value">—</span>') + '</div></div>'
    }

    const itemRows = Array.from({ length: Math.max(3, items.length) }, (_, index) => {
      const item = items[index]
      const itemType = String(item?.type || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
      return '<tr><td>' + esc(itemType) + '</td><td>' + esc(item?.description || '') + '</td><td class="qty-cell">' + (item ? esc(item.quantity) : '') + '</td><td>' + esc(item?.remarks || '') + '</td></tr>'
    }).join('')

    const checklistTable = (rows: string[][]) => rows.map(row => {
      const value = checks[row[0]]
      const isChecked = value === 'OK' || value === 'REPAIR'
      const isNa = value === 'NA'
      const repairText = value === 'REPAIR' ? '<small>Repair</small>' : ''
      return '<tr><td class="check-name"><span>' + esc(row[1]) + '</span><small dir="rtl">' + esc(row[2]) + '</small></td><td class="check-cell"><span class="check-box' + (isChecked ? ' is-checked' : '') + '">' + (isChecked ? '✓' : '') + '</span>' + repairText + '</td><td class="check-cell"><span class="check-box' + (isNa ? ' is-checked' : '') + '">' + (isNa ? '✓' : '') + '</span></td></tr>'
    }).join('')

    const fields = [
      field('Truck / Trailer No.', 'رقم المركبة', plate),
      field('Vehicle type', 'نوع المركبة', truck ? 'Truck' : 'Trailer'),
      field('Make / Model', 'الماركة والطراز', truck ? [truck.make, truck.model].filter(Boolean).join(' ') : 'Trailer'),
      field('Year', 'سنة الصنع', truck?.year ?? ''),
      field('VIN / Chassis', 'رقم الهيكل', truck?.vin || ''),
      field('Odometer (km)', 'العداد', printNumber(card.odometerKm)),
      field('Service type', 'نوع الصيانة', card.serviceType || ''),
      field('Technician', 'الفني', card.technicianName || ''),
      field('Driver', 'السائق', card.driverName || ''),
      field('Next service (km)', 'العداد القادم', printNumber(card.nextServiceOdometer) || '—'),
      field('Next service date', 'تاريخ الصيانة القادمة', printDateText(card.nextServiceDate))
    ].join('')

    return [
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>',
      esc(card.jobNumber), ' · Job Card</title><style>',
      '@page{size:A4 portrait;margin:0}',
      '*{box-sizing:border-box}',
      'html,body{margin:0;padding:0;color:#1b2e28;font-family:Arial,"Noto Sans Arabic",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      'body{background:#eef2ef}',
      '.print-page{width:100%;max-width:210mm;aspect-ratio:210/297;margin:0 auto;padding:5mm;display:flex;background:#fff}',
      '.card-frame{width:100%;flex:1;border:1.7px solid #244b3d;padding:4mm;display:flex;flex-direction:column;gap:2.6mm;background:#fff}',
      '.masthead{display:grid;grid-template-columns:100px minmax(0,1fr) 145px;align-items:center;gap:12px;padding:1px 2px 9px;border-bottom:2px solid #d8e4dd}',
      '.logo-wrap{display:flex;align-items:center;justify-content:center;min-height:62px}',
      '.logo-wrap img{display:block;width:94px;height:60px;object-fit:contain}',
      '.eyebrow{margin-bottom:3px;color:#648073;font-size:8px;font-weight:700;letter-spacing:1.25px;text-transform:uppercase}',
      '.company-name{color:#315b4a;font-size:11px;font-weight:700}',
      '.main-title{margin:3px 0 0;color:#172c24;font-size:24px;font-weight:800;line-height:1.05;letter-spacing:-.45px}',
      '.main-title span{margin-left:5px;color:#537265;font-size:15px;font-weight:600;letter-spacing:0}',
      '.doc-code{display:flex;flex-direction:column;align-items:flex-end;gap:3px;border-left:2px solid #c6944e;padding-left:10px;text-align:right}',
      '.doc-code span{color:#728279;font-size:7px;font-weight:700;letter-spacing:.65px;text-transform:uppercase}',
      '.doc-code strong{color:#244b3d;font-size:11px}',
      '.contact-line{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:6px;padding:0 2px 1px;color:#607168;font-size:7.5px}',
      '.contact-line span{overflow-wrap:anywhere}',
      '.summary-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:6px}',
      '.summary-card{min-height:42px;border:1px solid #dce6e0;border-radius:3px;background:#f6f9f7;padding:6px 8px}',
      '.summary-label{display:block;margin-bottom:3px;color:#718178;font-size:7px;font-weight:700;letter-spacing:.55px;text-transform:uppercase}',
      '.summary-value{display:block;color:#1e352c;font-size:10px;font-weight:700;overflow-wrap:anywhere}',
      '.status-pill{display:inline-flex;align-items:center;border-radius:99px;background:#e5eee9;padding:2px 7px;color:#315a47;font-size:8px;font-weight:700}',
      '.status-pill.in-progress{background:#fff1d9;color:#805717}.status-pill.completed{background:#e5f4eb;color:#206341}.status-pill.cancelled{background:#fce9e9;color:#913f3f}',
      '.section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:25px;border-left:3px solid #c6944e;background:#214a3b;padding:5px 8px;color:#fff}',
      '.section-title{display:flex;align-items:center;gap:7px;margin:0;font-size:9px;font-weight:700;letter-spacing:.45px;text-transform:uppercase}',
      '.section-index{color:#e9c88c;font-size:8px}',
      '.section-ar{font-size:9px;font-weight:600}',
      '.vehicle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #dbe4df;border-left:1px solid #dbe4df}',
      '.field{min-height:39px;border-right:1px solid #dbe4df;border-bottom:1px solid #dbe4df;background:#fff;padding:5px 7px}',
      '.field-label{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:4px;color:#738279;font-size:6.8px;font-weight:700;letter-spacing:.35px;text-transform:uppercase}',
      '.field-label [dir=rtl]{font-size:7.5px;letter-spacing:0;text-transform:none}',
      '.field-value{min-height:12px;color:#20382e;font-size:9.5px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}',
      '.empty-value{color:#aab5af;font-weight:400}',
      '.issue-panel{min-height:39px;border:1px solid #dbe4df;border-radius:2px;background:#fbfcfb;padding:7px 9px;color:#263a31;font-size:9px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.items-table,.check-table{width:100%;border-collapse:collapse;table-layout:fixed}',
      '.items-table th,.items-table td{border:1px solid #dbe4df;padding:5px 6px;text-align:left;vertical-align:middle;overflow-wrap:anywhere}',
      '.items-table th{background:#edf3ef;color:#455d50;font-size:7px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}',
      '.items-table td{height:22px;color:#263a31;font-size:8px;line-height:1.25}',
      '.items-table tr:nth-child(even) td{background:#fafcfb}',
      '.items-table .qty-cell{text-align:center;font-weight:700}',
      '.check-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '.check-table th,.check-table td{border:1px solid #dbe4df;padding:4px 5px;vertical-align:middle}',
      '.check-table th{background:#edf3ef;color:#455d50;font-size:6.7px;font-weight:700;text-align:center}',
      '.check-table th:first-child{text-align:left}',
      '.check-table td{height:24px;background:#fff}',
      '.check-name span,.check-name small{display:block}',
      '.check-name span{color:#263a31;font-size:7.2px;font-weight:600}',
      '.check-name small{margin-top:1px;color:#74847b;font-size:7px}',
      '.check-cell{width:16%;text-align:center;white-space:nowrap}',
      '.check-box{display:inline-flex;width:12px;height:12px;align-items:center;justify-content:center;border:1px solid #9aaba1;border-radius:2px;color:#fff;font-size:9px;font-weight:800;vertical-align:middle}',
      '.check-box.is-checked{border-color:#2f684d;background:#2f684d}',
      '.check-cell small{display:inline-block;margin-left:2px;color:#8a5e21;font-size:6px;vertical-align:middle}',
      '.notes-panel{min-height:27px;border:1px solid #dbe4df;border-left:3px solid #c6944e;background:#fafcfb;padding:6px 8px;color:#33483d;font-size:8px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.notes-panel strong{margin-right:4px;color:#62746a;font-size:7px;text-transform:uppercase}',
      '.service-strip{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dbe4df}',
      '.service-cell{min-height:34px;padding:6px 8px}.service-cell+ .service-cell{border-left:1px solid #dbe4df}',
      '.service-label{display:block;margin-bottom:3px;color:#738279;font-size:7px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}',
      '.service-value{color:#233a30;font-size:9px;font-weight:700}',
      '.completion-note{display:flex;justify-content:space-between;gap:8px;border:1px solid #dbe4df;background:#f4f8f5;padding:6px 8px;color:#456052;font-size:8px;font-weight:600}',
      '.signatures-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}',
      '.signature-box{min-height:45px;border:1px solid #dbe4df;padding:5px 7px}',
      '.signature-value{min-height:17px;border-bottom:1px dotted #8c9b92;color:#2c4939;font-size:8px;font-style:italic;overflow-wrap:anywhere}',
      '.signature-label{display:flex;justify-content:space-between;gap:5px;margin-top:4px;color:#687a70;font-size:6.7px;font-weight:700}',
      '.doc-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;border-top:1px solid #dbe4df;padding-top:6px}',
      '.scan-block{display:flex;align-items:center;gap:7px}',
      '.scan-block img{width:42px;height:42px;object-fit:contain}',
      '.scan-copy strong,.scan-copy span{display:block}',
      '.scan-copy strong{color:#315544;font-size:7.5px}',
      '.scan-copy span{margin-top:2px;color:#718178;font-size:6.5px}',
      '.form-ref{text-align:right;color:#75847b;font-size:6.5px}',
      '.form-ref strong,.form-ref span{display:block}',
      '.form-ref strong{margin-top:3px;color:#335644;font-size:8px}',
      '@media screen and (max-width:720px){body{background:#eef2ef}.print-page{width:100%;aspect-ratio:auto;min-height:100vh;padding:10px}.card-frame{gap:9px;padding:12px}.masthead{grid-template-columns:72px minmax(0,1fr);gap:8px}.logo-wrap{min-height:54px}.logo-wrap img{width:68px;height:48px}.main-title{font-size:20px}.main-title span{font-size:13px}.doc-code{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;border-left:0;border-top:1px solid #dbe4df;padding:6px 0 0;text-align:left}.contact-line{grid-template-columns:1fr;gap:4px}.summary-grid{grid-template-columns:1fr 1fr}.vehicle-grid{grid-template-columns:1fr 1fr}.check-grid{grid-template-columns:1fr}.doc-footer{align-items:flex-start}}',
      '@media screen and (max-width:420px){.print-page{padding:6px}.card-frame{padding:9px}.main-title{font-size:18px}.summary-card{padding:5px}.vehicle-grid{grid-template-columns:1fr}.section-heading{align-items:flex-start}.section-title{font-size:8px}.section-ar{font-size:8px}.signatures-grid{grid-template-columns:1fr}.completion-note{flex-direction:column;gap:3px}.items-table th,.items-table td{padding:4px 3px;font-size:7px}}',
      '@media print{html,body{width:210mm;height:297mm;min-height:297mm;overflow:hidden;margin:0!important;padding:0!important;background:#fff!important}.print-page{width:210mm;max-width:210mm;height:297mm;min-height:297mm;margin:0;padding:5mm;break-inside:avoid;page-break-inside:avoid}.card-frame{min-height:0;height:100%;padding:4mm;gap:2.3mm;break-inside:avoid;page-break-inside:avoid}.masthead{grid-template-columns:100px minmax(0,1fr) 145px}.contact-line{grid-template-columns:1.15fr 1fr 1fr}.summary-grid{grid-template-columns:1.2fr 1fr 1fr 1fr}.vehicle-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.check-grid{grid-template-columns:1fr 1fr}.signatures-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.completion-note{flex-direction:row}.doc-footer{margin-top:auto}tr,section,.masthead,.summary-grid,.doc-footer{break-inside:avoid;page-break-inside:avoid}}',
      '</style></head><body><main class="print-page"><article class="card-frame">',
      '<header class="masthead"><div class="logo-wrap"><img src="', esc(origin), '/saadfreeh-transport-logo.png" alt="Saadfreeh Transportation"></div>',
      '<div class="company-lockup"><div class="eyebrow">Workshop &amp; Fleet Maintenance</div><div class="company-name">', esc(companyName), '</div><h1 class="main-title">Job Card <span dir="rtl">أمر شغل</span></h1></div>',
      '<div class="doc-code"><span>Workshop service document</span><strong>FORM · JC-01</strong><span>Revision 6 · A4 Portrait</span></div></header>',
      '<div class="contact-line"><span>', esc(companyAddress), '</span><span>', esc(companyPhone), '</span><span>', esc(companyEmail), '</span></div>',
      '<section class="summary-grid">',
      '<div class="summary-card"><span class="summary-label">Job number · رقم الأمر</span><strong class="summary-value">', esc(card.jobNumber), '</strong></div>',
      '<div class="summary-card"><span class="summary-label">Service date · التاريخ</span><strong class="summary-value">', printDateText(card.serviceDate), '</strong></div>',
      '<div class="summary-card"><span class="summary-label">Status · الحالة</span><span class="status-pill ', statusClass, '">', esc(printStatus || 'Open'), '</span></div>',
      '<div class="summary-card"><span class="summary-label">Priority · الأولوية</span><strong class="summary-value">', esc(card.priority || 'NORMAL'), '</strong></div>',
      '</section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">01</span> Vehicle &amp; Service Details</h2><span class="section-ar" dir="rtl">بيانات المركبة والصيانة</span></div><div class="vehicle-grid">', fields, '</div></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">02</span> Reported Issue</h2><span class="section-ar" dir="rtl">الشكوى والملاحظات</span></div><div class="issue-panel">', esc(card.reportedIssue || ''), '</div></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">03</span> Work Performed &amp; Spare Parts</h2><span class="section-ar" dir="rtl">الأعمال المنجزة وقطع الغيار</span></div>',
      '<table class="items-table"><colgroup><col style="width:17%"><col style="width:45%"><col style="width:10%"><col style="width:28%"></colgroup><thead><tr><th>Item type · النوع</th><th>Description · الوصف</th><th>Qty</th><th>Remarks · ملاحظات</th></tr></thead><tbody>', itemRows, '</tbody></table></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">04</span> Maintenance Checklist</h2><span class="section-ar" dir="rtl">قائمة الفحص الدوري</span></div>',
      '<div class="check-grid"><table class="check-table"><colgroup><col style="width:68%"><col style="width:18%"><col style="width:14%"></colgroup><thead><tr><th>Inspection point · بند الفحص</th><th>OK / Repair</th><th>N/A</th></tr></thead><tbody>',
      checklistTable(checklistItems.slice(0, 5)), '</tbody></table>',
      '<table class="check-table"><colgroup><col style="width:68%"><col style="width:18%"><col style="width:14%"></colgroup><thead><tr><th>Inspection point · بند الفحص</th><th>OK / Repair</th><th>N/A</th></tr></thead><tbody>',
      checklistTable(checklistItems.slice(5)), '</tbody></table></div></section>',
      '<div class="notes-panel"><strong>Notes · ملاحظات</strong>', esc(card.notes || '—'), '</div>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">05</span> Next Service &amp; Approval</h2><span class="section-ar" dir="rtl">الصيانة القادمة والاعتماد</span></div>',
      '<div class="service-strip"><div class="service-cell"><span class="service-label">Next service odometer · العداد القادم</span><strong class="service-value">', esc(printNumber(card.nextServiceOdometer) || '—'), '</strong></div><div class="service-cell"><span class="service-label">Next service date · تاريخ الصيانة القادمة</span><strong class="service-value">', printDateText(card.nextServiceDate), '</strong></div></div></section>',
      '<div class="completion-note"><span>', completionEnglish, '</span><span dir="rtl">', completionArabic, '</span></div>',
      '<section class="signatures-grid">',
      '<div class="signature-box"><div class="signature-value">', esc(card.technicianSignature || ''), '</div><div class="signature-label"><span>Technician signature</span><span dir="rtl">توقيع الفني</span></div></div>',
      '<div class="signature-box"><div class="signature-value">', esc(card.supervisorSignature || ''), '</div><div class="signature-label"><span>Supervisor signature</span><span dir="rtl">توقيع المشرف</span></div></div>',
      '<div class="signature-box"><div class="signature-value">', esc(card.driverSignature || ''), '</div><div class="signature-label"><span>Driver / customer</span><span dir="rtl">توقيع السائق</span></div></div>',
      '</section>',
      '<footer class="doc-footer"><div class="scan-block"><img src="', qrDataUrl, '" alt="Job card verification QR code"><div class="scan-copy"><strong>Job card verification</strong><span>Scan to identify this job card</span><span dir="rtl">امسح للتعرف على بطاقة العمل</span></div></div><div class="form-ref"><span>Saadfreeh Transport Est.</span><span>Workshop Job Card System</span><strong>JC-01 · REV 6</strong></div></footer>',
      '</article></main></body></html>'
    ].join('')
  }
