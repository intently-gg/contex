import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize2, Zap, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { copyToClipboard } from "@/lib/utils"
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

  const getResultText = (): string => {
    if (error) {
      return error.message || "Transaction failed"
    }
    if (hash) {
      let text = `Hash: ${hash}`
      if (isConfirming) text += " (Confirming...)"
      if (isConfirmed) text += " (Confirmed!)"
      return text
    }
    if (result !== undefined) {
      if (typeof result === "string") return result
      if (typeof result === "number" || typeof result === "bigint") return String(result)
      if (typeof result === "boolean") return String(result)
      try {
        return JSON.stringify(result)
      } catch {
        return String(result)
      }
    }
    return ""
  }

  const resultText = getResultText()
  const isError = !!error
  const hasResult = error || hash || result !== undefined

  // Check if text is overflowing
  useEffect(() => {
    if (textRef.current && hasResult) {
      const element = textRef.current
      setIsOverflowing(element.scrollWidth > element.clientWidth)
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
      <div className="flex items-center gap-2 border-t pt-2 mt-4">
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

        {/* Expand Button - only show if text is overflowing */}
        {isOverflowing && (
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

        {/* Result Text */}
        {hasResult && (
          <div
            ref={textRef}
            className="flex-1 min-w-0 text-sm overflow-hidden"
            style={{
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: isError ? "hsl(var(--destructive))" : undefined,
            }}
          >
            {isError && <AlertCircle className="inline h-4 w-4 mr-1" />}
            {hash && !isError && <CheckCircle2 className="inline h-4 w-4 mr-1" />}
            {resultText}
          </div>
        )}
      </div>

      {/* Expand Modal */}
      <ExpandResultModal
        open={expandOpen}
        onOpenChange={setExpandOpen}
        error={error}
        hash={hash}
        isConfirming={isConfirming}
        isConfirmed={isConfirmed}
        result={result}
      />
    </>
  )
}

