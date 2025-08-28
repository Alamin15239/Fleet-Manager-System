'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatSAR, parseSAR, formatCurrencyForInput, CurrencySettings } from '@/lib/currency'

interface CurrencyInputProps {
  id?: string
  label?: string
  value: number | string
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  settings?: CurrencySettings
}

export function CurrencyInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0.00',
  disabled = false,
  required = false,
  className = '',
  settings
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Define currency settings first, before using them in hooks
  const currencySettings = settings || {
    currencySymbol: '﷼',
    currencyCode: 'SAR',
    currencyName: 'Saudi Riyal',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'before' as const
  }

  // Debug log to check currency settings
  console.log('CurrencyInput currencySettings:', currencySettings)
  console.log('CurrencyInput value prop:', { value, type: typeof value })

  // Update display value when prop changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrencyForInput(value, currencySettings))
    }
  }, [value, isFocused, currencySettings])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setDisplayValue(formatCurrencyForInput(value, currencySettings))
  }, [value, currencySettings])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    const parsedValue = parseSAR(displayValue, currencySettings)
    console.log('CurrencyInput handleBlur:', { displayValue, parsedValue, currencySettings })
    onChange(parsedValue)
    setDisplayValue(formatCurrencyForInput(parsedValue, currencySettings))
  }, [displayValue, onChange, currencySettings])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    // Allow only numbers, decimal point, and minus sign
    if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
      setDisplayValue(newValue)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur()
    }
  }, [handleBlur])

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
          {currencySettings.currencySymbol}
        </span>
        <Input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-8"
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
          {currencySettings.currencyCode}
        </span>
      </div>
    </div>
  )
}