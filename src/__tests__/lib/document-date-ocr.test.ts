import { extractDocumentDates } from '@/lib/document-date-ocr'

describe('extractDocumentDates', () => {
  it('reads English issue and expiry dates using Saudi day/month/year order', () => {
    expect(extractDocumentDates('Issue Date: 01/08/2027\nExpiry Date: 15/08/2028')).toEqual({
      validFrom: '2027-08-01',
      validUntil: '2028-08-15',
    })
  })

  it('normalizes Arabic-Indic digits and Arabic expiry labels', () => {
    expect(extractDocumentDates('تاريخ الإصدار ٠١/٠٨/٢٠٢٧\nتاريخ الانتهاء ١٥/٠٨/٢٠٢٨')).toEqual({
      validFrom: '2027-08-01',
      validUntil: '2028-08-15',
    })
  })

  it('parses year-first numeric dates without treating the day as a short year', () => {
    expect(extractDocumentDates('Expiry Date: 2028/08/15')).toEqual({
      validFrom: undefined,
      validUntil: '2028-08-15',
    })
  })

  it('supports two-digit years in day/month/year dates', () => {
    expect(extractDocumentDates('Expiry Date: 15/08/28')).toEqual({
      validFrom: undefined,
      validUntil: '2028-08-15',
    })
  })
})
