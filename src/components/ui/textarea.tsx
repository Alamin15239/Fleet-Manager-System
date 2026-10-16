'use client'

import * as React from "react"

import { cn } from "@/lib/utils"
import { useLanguage } from '@/contexts/language-context'

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, placeholder, ...props }, ref) => {
    const { t } = useLanguage()

    return (
      <textarea
        placeholder={typeof placeholder === 'string' ? t(placeholder) : placeholder}
        className={cn(
          "flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
