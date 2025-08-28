'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeProps {
  value: string
  size?: number
  className?: string
}

export default function QRCodeComponent({ value, size = 96, className = "" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      console.log('Generating QR code with value:', value) // Debug log
      
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      }, (error) => {
        if (error) {
          console.error('Error generating QR code:', error)
        } else {
          console.log('QR code generated successfully') // Debug log
        }
      })
    }
  }, [value, size])

  return (
    <div className={className}>
      <canvas 
        ref={canvasRef} 
        width={size} 
        height={size} 
        className="block border border-gray-200 rounded"
        style={{ backgroundColor: '#FFFFFF' }}
      />
    </div>
  )
}