import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { ResultRenderer } from "./ResultRenderer"

interface ExpandResultModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error?: Error | null
  hash?: string
  isConfirming?: boolean
  isConfirmed?: boolean
  result?: unknown
}

export function ExpandResultModal({
  open,
  onOpenChange,
  error,
  hash,
  isConfirming = false,
  isConfirmed = false,
  result,
}: ExpandResultModalProps) {
  const hasResult = error || hash || result !== undefined

  // Determine if result is complex (array/object) - same logic as ReadFunction
  const isComplexValue = useMemo(() => {
    if (error || result === undefined) return false
    return typeof result === "object" && result !== null && !(result instanceof Date)
  }, [result, error])

  const isSimpleValue = !error && result !== undefined && !isComplexValue

  if (!hasResult) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Result</DialogTitle>
          <DialogDescription>Full result content</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {error ? (
            <Alert variant="destructive" className="max-w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription
                className="text-pink-600 dark:text-pink-400 break-words overflow-wrap-anywhere whitespace-pre-wrap"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  maxWidth: "100%",
                  overflowX: "hidden",
                  paddingLeft: "3px",
                }}
              >
                {error.message || "Transaction failed"}
              </AlertDescription>
            </Alert>
          ) : hash ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Transaction Submitted</AlertTitle>
              <AlertDescription>
                Hash: {hash}
                {isConfirming && " (Confirming...)"}
                {isConfirmed && " (Confirmed!)"}
              </AlertDescription>
            </Alert>
          ) : result !== undefined ? (
            isSimpleValue ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Value</div>
                <div className="rounded-md bg-muted p-3 text-sm border">
                  {String(result)}
                </div>
              </div>
            ) : (
              <ResultRenderer value={result} />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

