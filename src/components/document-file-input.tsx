'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { LocalizedText } from '@/components/localized-text'

type DocumentFileInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'type' | 'onChange'> & {
  onFileSelected: (file: File | null) => void
}

export const DocumentFileInput = React.forwardRef<HTMLInputElement, DocumentFileInputProps>(
  function DocumentFileInput({ className, disabled, onFileSelected, ...props }, ref) {
    const [dragging, setDragging] = React.useState(false)

    const handleDrag = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!disabled) setDragging(true)
    }

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setDragging(false)
      if (!disabled) onFileSelected(event.dataTransfer.files?.[0] || null)
    }

    return (
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={event => {
          event.preventDefault()
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed px-3 py-2 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-input bg-background/40'} ${disabled ? 'opacity-60' : ''}`}
      >
        <Input
          {...props}
          ref={ref}
          type="file"
          disabled={disabled}
          onChange={event => onFileSelected(event.target.files?.[0] || null)}
          className={`h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 ${className || ''}`}
        />
        <p className="pt-1 text-xs text-muted-foreground">
          <LocalizedText>Drop files here or click to upload</LocalizedText>
        </p>
      </div>
    )
  },
)
