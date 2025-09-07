'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pen, Eraser, Save, X } from 'lucide-react'

interface SignaturePadProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signature: string) => void
  title?: string
}

export function SignaturePad({ isOpen, onClose, onSave, title = 'Digital Signature' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        setContext(ctx)
        
        // Set canvas size
        canvas.width = 400
        canvas.height = 200
        
        // Fill with white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [isOpen])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!context || !canvasRef.current) return
    
    setIsDrawing(true)
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    context.beginPath()
    context.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    context.lineTo(x, y)
    context.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!context || !canvasRef.current) return
    
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const saveSignature = () => {
    if (!canvasRef.current) return
    
    const dataURL = canvasRef.current.toDataURL('image/png')
    onSave(dataURL)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="border border-gray-300 rounded bg-white cursor-crosshair w-full"
              style={{ maxWidth: '100%', height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <p className="text-sm text-gray-500 mt-2 text-center">
              Click and drag to sign
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={clearCanvas}
              className="flex-1"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={saveSignature}>
            <Save className="h-4 w-4 mr-2" />
            Save Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}