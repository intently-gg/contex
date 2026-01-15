import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, onPaste, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const combinedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = "auto"
      const scrollHeight = textarea.scrollHeight
      
      const maxHeight = window.getComputedStyle(textarea).maxHeight
      const maxHeightValue = maxHeight !== "none" ? parseInt(maxHeight, 10) : null
      
      if (maxHeightValue && scrollHeight > maxHeightValue) {
        textarea.style.height = `${maxHeightValue}px`
        textarea.style.overflowY = "auto"
      } else {
        textarea.style.height = `${scrollHeight}px`
        textarea.style.overflowY = "hidden"
      }
    }, [])

    React.useEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e)
      setTimeout(adjustHeight, 0)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      onPaste?.(e)
      setTimeout(adjustHeight, 0)
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[50px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={combinedRef}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

