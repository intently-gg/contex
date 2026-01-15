import { useState, useRef, useMemo, useEffect } from "react"
import { useChainId, useChains } from "wagmi"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, Check, Maximize2, Zap, RefreshCw, AlertCircle, CheckCircle2, Binary } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
  isReverted?: boolean
  result?: unknown
  onExecute?: () => void
  onRefresh?: () => void
  showCheckmark?: boolean
  disabled?: boolean
  onEncodeToClipboard?: () => void
  onEncodeToClipboardSync?: () => string | null // Returns encoded data synchronously
  onEncodeToFunction?: () => void
  encodeError?: Error | null
  encodeSuccess?: boolean
  onEncodeSuccessAck?: () => void
}

export function ResultPane({
  type,
  isLoading = false,
  error,
  hash,
  isConfirming = false,
  isConfirmed = false,
  isReverted = false,
  result,
  onExecute,
  onRefresh,
  showCheckmark = false,
  disabled = false,
  onEncodeToClipboard,
  onEncodeToClipboardSync,
  onEncodeToFunction,
  encodeError,
  encodeSuccess = false,
  onEncodeSuccessAck,
}: ResultPaneProps) {
  const [copied, setCopied] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)
  const [showEncodeCheckmark, setShowEncodeCheckmark] = useState(false)
  const [encodeDropdownOpen, setEncodeDropdownOpen] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  const chainId = useChainId()
  const chains = useChains()

  // Sanitize result and error for React DevTools (convert BigInt to string)
  const sanitizedResult = useMemo(() => {
    if (result === undefined) return undefined
    return sanitizeForSerialization(result)
  }, [result])

  const sanitizedError = useMemo(() => {
    if (!error && !encodeError) return null
    const errorToSanitize = encodeError || error
    // Create a new error object with sanitized properties
    const sanitized = sanitizeForSerialization(errorToSanitize)
    if (sanitized && typeof sanitized === "object" && "message" in sanitized) {
      const err = new Error(String(sanitized.message))
      if ("name" in sanitized) err.name = String(sanitized.name)
      if ("stack" in sanitized) err.stack = String(sanitized.stack)
      // Copy other sanitized properties
      Object.assign(err, sanitized)
      return err
    }
    return errorToSanitize
  }, [error, encodeError])

  const explorerTxUrl = useMemo(() => {
    if (!hash) return null
    const chain = chains.find((c) => c.id === chainId)
    const baseUrl = chain?.blockExplorers?.default?.url
    if (!baseUrl) return null
    return `${baseUrl}/tx/${hash}`
  }, [chains, chainId, hash])

  const getResultText = (): string => {
    if (sanitizedError) {
      // Replace newlines with spaces for single-line display
      return (sanitizedError.message || "Transaction failed").replace(/\n/g, " ").replace(/\s+/g, " ").trim()
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

  const getRawValueForCopy = (): string => {
    if (sanitizedError) {
      return (sanitizedError.message || "Transaction failed").replace(/\n/g, " ").replace(/\s+/g, " ").trim()
    }
    if (result !== undefined) {
      if (typeof result === "string") {
        return result.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
      } else if (typeof result === "number" || typeof result === "bigint") {
        return String(result)
      } else if (typeof result === "boolean") {
        return String(result)
      } else {
        try {
          const str = safeStringify(result)
          return str.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
        } catch {
          return String(result)
        }
      }
    }
    return ""
  }

  // Determine if result is complex (array/object) - for read functions, use ResultRenderer
  const isComplexValue = useMemo(() => {
    if (sanitizedError || sanitizedResult === undefined) return false
    return typeof sanitizedResult === "object" && sanitizedResult !== null && !(sanitizedResult instanceof Date)
  }, [sanitizedResult, sanitizedError])

  const shouldUseRenderer = type === "read" && isComplexValue && !sanitizedError && !hash

  // Show encode checkmark briefly on success
  useEffect(() => {
    if (encodeSuccess) {
      setShowEncodeCheckmark(true)
      const timer = setTimeout(() => {
        setShowEncodeCheckmark(false)
        onEncodeSuccessAck?.()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [encodeSuccess, onEncodeSuccessAck])

  const resultText = getResultText()
  const isError = !!sanitizedError
  const hasResult = sanitizedError || hash || result !== undefined


  const handleCopy = async () => {
    if (!hasResult) return
    const valueToCopy = getRawValueForCopy()
    const success = await copyToClipboard(valueToCopy)
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
              className="flex-shrink-0 transition-colors"
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
              className="flex-shrink-0 transition-colors"
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

          {/* Encode Dropdown */}
          {(onEncodeToClipboard || onEncodeToFunction) && (
            <DropdownMenu open={encodeDropdownOpen} onOpenChange={setEncodeDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={disabled}
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 transition-colors"
                >
                  {showEncodeCheckmark ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Binary className="mr-2 h-4 w-4" />
                  )}
                  Encode
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem
                  disabled={!onEncodeToClipboard && !onEncodeToClipboardSync}
                  className="cursor-pointer"
                  onSelect={async (e) => {
                    e.preventDefault()
                    setEncodeDropdownOpen(false)
                    
                    // Get encoded data synchronously
                    if (onEncodeToClipboardSync) {
                      const encodedData = onEncodeToClipboardSync()
                      if (encodedData) {
                        // Use the same copyToClipboard utility that works everywhere else
                        const success = await copyToClipboard(encodedData)
                        if (success) {
                          toast.success("Encoded bytes copied to clipboard")
                          // Call async handler for state updates
                          onEncodeToClipboard?.()
                        } else {
                          toast.error("Failed to copy to clipboard")
                        }
                        return
                      }
                    }
                    
                    // Fallback to async handler
                    if (onEncodeToClipboard) {
                      onEncodeToClipboard().catch((err) => {
                        console.error("Clipboard operation failed:", err)
                      })
                    }
                  }}
                >
                  To Clipboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!onEncodeToFunction}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEncodeDropdownOpen(false)
                    if (onEncodeToFunction) {
                      onEncodeToFunction()
                    }
                  }}
                  onSelect={(e) => {
                    e.preventDefault()
                  }}
                >
                  To Function
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
            className="w-full space-y-1"
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
            {isError && (
              <div>
                <AlertCircle className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle" />
                <span>{resultText}</span>
              </div>
            )}
            {!isError && !hash && resultText && <div>{resultText}</div>}
            {hash && (
              <div>
                {!isError && (
                  <CheckCircle2 className="inline h-4 w-4 mr-1 flex-shrink-0 align-middle text-emerald-500" />
                )}
                <span>
                  Hash:{" "}
                  {explorerTxUrl ? (
                    <a
                      href={explorerTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {hash}
                    </a>
                  ) : (
                    hash
                  )}
                  {isConfirming && !isReverted && " (Confirming...)"}
                  {isReverted && " (Reverted)"}
                  {isConfirmed && !isReverted && (
                    <span className="text-emerald-600"> (Confirmed!)</span>
                  )}
                </span>
              </div>
            )}
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
        explorerTxUrl={explorerTxUrl}
        isConfirming={isConfirming}
        isConfirmed={isConfirmed}
        isReverted={isReverted}
        result={sanitizedResult}
      />
    </>
  )
}

