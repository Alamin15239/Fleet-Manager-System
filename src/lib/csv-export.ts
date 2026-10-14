export function rowsToCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(value => {
    let text = String(value ?? '')
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }).join(',')).join('\r\n')
}
