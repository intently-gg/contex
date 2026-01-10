import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize2, Zap, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { copyToClipboard, safeStringify, sanitizeForSerialization } from "@/lib/utils"
import { toast } from "sonner"
import { ExpandResultModal } from "./ExpandResultModal"

interface ResultPaneProps {
  type: "write" | "read"
  isLoading?: boolean
  error?: Error | null
  hash?: string
  isConfirming?: boolean
  isConfirmed?: boolean
  result?: unknown
  onExecute?: () => void
  onRefresh?: () => void
  showCheckmark?: boolean
  disabled?: boolean
}

export function ResultPane({
  type,
  isLoading = false,
  error,
  hash,
  isConfirming = false,
  isConfirmed = false,
  result,
  onExecute,
  onRefresh,
  showCheckmark = false,
  disabled = false,
}: ResultPaneProps) {
  const [copied, setCopied] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  // Sanitize result and error for React DevTools (convert BigInt to string)
  const sanitizedResult = useMemo(() => {
    if (result === undefined) return undefined
    return sanitizeForSerialization(result)
  }, [result])

  const sanitizedError = useMemo(() => {
    if (!error) return null
    // Create a new error object with sanitized properties
    const sanitized = sanitizeForSerialization(error)
    if (sanitized && typeof sanitized === "object" && "message" in sanitized) {
      const err = new Error(String(sanitized.message))
      if ("name" in sanitized) err.name = String(sanitized.name)
      if ("stack" in sanitized) err.stack = String(sanitized.stack)
      // Copy other sanitized properties
      Object.assign(err, sanitized)
      return err
    }
    return error
  }, [error])

  const getResultText = (): string => {
    if (sanitizedError) {
      // Replace newlines with spaces for single-line display
      return (sanitizedError.message || "Transaction failed").replace(/\n/g, " ").replace(/\s+/g, " ").trim()
    }
    if (hash) {
      let text = `Hash: ${hash}`
      if (isConfirming) text += " (Confirming...)"
      if (isConfirmed) text += " (Confirmed!)"
      return text
    }
    if (result !== undefined) {
      let formattedResult: string
      if (typeof result === "string") {
        formattedResult = result.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
      } else if (typeof result === "number" || typeof result === "bigint") {
        formattedResult = String(result)
      } else if (typeof result === "boolean") {
        formattedResult = String(result)
      } else {
        try {
          const str = safeStringify(result)
          formattedResult = str.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
        } catch {
          formattedResult = String(result)
        }
      }
      return `Result: ${formattedResult}`
    }
    return ""
  }

  const resultText = getResultText()
  const isError = !!sanitizedError
  const hasResult = sanitizedError || hash || result !== undefined

  // Check if text is overflowing
  useEffect(() => {
    if (textRef.current && hasResult) {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        if (textRef.current) {
          const element = textRef.current
          setIsOverflowing(element.scrollWidth > element.clientWidth)
        }
      })
    } else {
      setIsOverflowing(false)
    }
  }, [resultText, hasResult])

  const handleCopy = async () => {
    if (!hasResult) return
    const success = await copyToClipboard(resultText)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      toast.success("Copied to clipboard")
    } else {
      toast.error("Failed to copy to clipboard")
    }
  }

  return (
    <>
      <div 
        className="flex items-center gap-2 border-t pt-2 mt-4 flex-shrink-0" 
        style={{ 
          width: "100%", 
          minWidth: 0, 
          maxWidth: "100%",
          overflow: "hidden",
          boxSizing: "border-box"
        }}
      >
        {/* Execute/Refresh Button */}
        {type === "write" ? (
          <Button
            onClick={onExecute}
            disabled={isLoading || isConfirming || disabled}
            size="sm"
            variant="default"
            className="flex-shrink-0"
          >
            <Zap className={`mr-2 h-4 w-4 ${isLoading || isConfirming ? "animate-pulse" : ""}`} />
            Execute
          </Button>
        ) : onRefresh ? (
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="flex-shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : showCheckmark ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Read
          </Button>
        ) : null}

        {/* Result Text */}
        {hasResult && (
          <div
            ref={textRef}
            className="text-sm"
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              width: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: isError ? "hsl(var(--destructive))" : undefined,
            }}
          >
            {isError && <AlertCircle className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle" />}
            {hash && !isError && <CheckCircle2 className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle" />}
            {resultText}
          </div>
        )}

        {/* Copy Button - only show if there's a result */}
        {hasResult && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        )}

        {/* Expand Button - show when there's a result */}
        {hasResult && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => setExpandOpen(true)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand result</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Expand Modal */}
      <ExpandResultModal
        open={expandOpen}
        onOpenChange={setExpandOpen}
        error={sanitizedError}
        hash={hash}
        isConfirming={isConfirming}
        isConfirmed={isConfirmed}
        result={sanitizedResult}
      />
    </>
  )
}

