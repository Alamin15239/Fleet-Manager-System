/**
 * Currency formatting utilities for Saudi Riyal (SAR)
 */

export interface CurrencySettings {
  currencySymbol: string
  currencyCode: string
  currencyName: string
  decimalPlaces: number
  thousandsSeparator: string
  decimalSeparator: string
  symbolPosition: 'before' | 'after'
}

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  currencySymbol: '﷼',
  currencyCode: 'SAR',
  currencyName: 'Saudi Riyal',
  decimalPlaces: 2,
  thousandsSeparator: ',',
  decimalSeparator: '.',
  symbolPosition: 'before'
}

/**
 * Format a number as currency using provided settings
 * @param amount The amount to format
 * @param settings Currency settings (optional, uses defaults if not provided)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number, 
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return `${settings.currencySymbol}0.00`
  }

  // Round to specified decimal places
  const roundedAmount = Math.round(numAmount * Math.pow(10, settings.decimalPlaces)) / Math.pow(10, settings.decimalPlaces)
  
  // Format the number with proper decimal places
  const formattedNumber = roundedAmount.toFixed(settings.decimalPlaces)
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = formattedNumber.split('.')
  
  // Add thousands separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, settings.thousandsSeparator)
  
  // Combine with currency symbol based on position
  if (settings.symbolPosition === 'before') {
    return `${settings.currencySymbol}${formattedInteger}${settings.decimalSeparator}${decimalPart}`
  } else {
    return `${formattedInteger}${settings.decimalSeparator}${decimalPart}${settings.currencySymbol}`
  }
}

/**
 * Format a number as Saudi Riyal currency (legacy function)
 * @param amount The amount to format
 * @param settings Currency settings (optional, uses defaults if not provided)
 * @returns Formatted currency string
 */
export function formatSAR(
  amount: number | string, 
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return formatCurrency(numAmount, settings)
}

/**
 * Parse a formatted currency string back to a number
 * @param currencyString The currency string to parse
 * @param settings Currency settings (optional, uses defaults if not provided)
 * @returns Parsed number
 */
export function parseCurrency(
  currencyString: string, 
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): number {
  console.log('parseCurrency called with:', { currencyString, settings })
  
  // Ensure settings is properly defined
  const safeSettings = settings || DEFAULT_CURRENCY_SETTINGS
  const { currencySymbol, thousandsSeparator, decimalSeparator } = safeSettings
  
  // Handle undefined or null currencyString
  if (!currencyString) {
    console.log('parseCurrency: currencyString is empty, returning 0')
    return 0
  }
  
  // Remove currency symbol and whitespace
  let cleanString = currencyString
  if (currencySymbol) {
    cleanString = cleanString.replace(new RegExp(`\\s*${currencySymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), '')
  }
  
  // Remove thousands separators
  if (thousandsSeparator) {
    cleanString = cleanString.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
  }
  
  // Replace decimal separator with period
  if (decimalSeparator && decimalSeparator !== '.') {
    cleanString = cleanString.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.')
  }
  
  // Parse as float
  const parsed = parseFloat(cleanString)
  
  console.log('parseCurrency result:', { cleanString, parsed, finalResult: isNaN(parsed) ? 0 : parsed })
  
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Parse a formatted SAR currency string back to a number (legacy function)
 * @param formattedString The formatted currency string
 * @param settings Currency settings (optional, uses defaults if not provided)
 * @returns Parsed number
 */
export function parseSAR(
  formattedString: string, 
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): number {
  console.log('parseSAR called with:', { formattedString, settings })
  
  // Handle undefined or null formattedString
  if (!formattedString) {
    console.log('parseSAR: formattedString is empty, returning 0')
    return 0
  }
  
  const result = parseCurrency(formattedString, settings)
  console.log('parseSAR result:', { result })
  return result
}

/**
 * Format currency for input fields (without currency symbol)
 * @param amount - The amount to format
 * @param settings - Currency settings (optional, uses default SAR settings)
 * @returns Formatted string for input
 */
export function formatCurrencyForInput(
  amount: number, 
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): string {
  const { decimalPlaces, thousandsSeparator, decimalSeparator } = settings
  
  console.log('formatCurrencyForInput called with:', { amount, type: typeof amount, settings })
  
  // Handle NaN or undefined values
  if (isNaN(amount) || amount === null || amount === undefined) {
    console.warn('formatCurrencyForInput: Invalid amount', { amount })
    return '0'
  }
  
  // Round to specified decimal places
  const roundedAmount = Math.round(amount * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = roundedAmount.toFixed(decimalPlaces).split('.')
  
  // Add thousands separators
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
  
  // Combine parts
  let formattedAmount = formattedInteger
  if (decimalPlaces > 0 && decimalPart) {
    formattedAmount += decimalSeparator + decimalPart
  }
  
  console.log('formatCurrencyForInput result:', { amount, roundedAmount, formattedAmount, settings })
  
  return formattedAmount
}

/**
 * Get currency display name
 * @param settings - Currency settings
 * @returns Display name (e.g., "Saudi Riyal (SAR)")
 */
export function getCurrencyDisplayName(settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS): string {
  const currencyNames: Record<string, string> = {
    'SAR': 'Saudi Riyal',
    'USD': 'US Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound'
  }
  
  const name = currencyNames[settings.currencyCode] || settings.currencyCode
  return `${name} (${settings.currencyCode})`
}

/**
 * Get currency display information (legacy function)
 * @param settings Currency settings (optional, uses defaults if not provided)
 * @returns Currency display info
 */
export function getCurrencyInfo(settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS) {
  return {
    symbol: settings.currencySymbol,
    code: settings.currencyCode,
    example: formatCurrency(1234.56, settings),
    name: settings.currencyName
  }
}