import { useState, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize2, Zap, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { copyToClipboard, safeStringify, sanitizeForSerialization } from "@/lib/utils"
import { toast } from "sonner"
import { ExpandResultModal } from "./ExpandResultModal"
import { ResultRenderer } from "./ResultRenderer"

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

  // Determine if result is complex (array/object) - for read functions, use ResultRenderer
  const isComplexValue = useMemo(() => {
    if (sanitizedError || sanitizedResult === undefined) return false
    return typeof sanitizedResult === "object" && sanitizedResult !== null && !(sanitizedResult instanceof Date)
  }, [sanitizedResult, sanitizedError])

  const shouldUseRenderer = type === "read" && isComplexValue && !sanitizedError && !hash

  const resultText = getResultText()
  const isError = !!sanitizedError
  const hasResult = sanitizedError || hash || result !== undefined


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
        className="border-t pt-2 mt-4 flex-shrink-0 flex flex-col gap-2"
        style={{ 
          width: "100%", 
          minWidth: 0, 
          maxWidth: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
          height: "100%"
        }}
      >
        {/* Button Row */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

          {/* Copy Button - only show if there's a result and not using ResultRenderer (which has its own copy button) */}
          {hasResult && !shouldUseRenderer && (
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

        {/* Result Text - show below buttons for simple values */}
        {hasResult && !shouldUseRenderer && (
          <div
            ref={textRef}
            className="w-full"
            style={{
              width: "100%",
              minWidth: 0,
              flex: "1 1 0",
              minHeight: 0,
              overflowY: "auto",
              wordBreak: "break-word",
              color: isError ? "hsl(var(--destructive))" : undefined,
            }}
          >
            {isError && <AlertCircle className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle" />}
            {hash && !isError && <CheckCircle2 className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle" />}
            {resultText}
          </div>
        )}

        {/* ResultRenderer - show below buttons for complex read results */}
        {shouldUseRenderer && (
          <div className="w-full flex-1 min-h-0 overflow-y-auto" style={{ width: "100%", minWidth: 0 }}>
            <ResultRenderer value={sanitizedResult} />
          </div>
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

