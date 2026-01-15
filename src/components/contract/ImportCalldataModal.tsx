import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { decodeFunctionData } from "viem"
import { generateFormFields } from "@/lib/formGenerator"
import { safeStringify, extractFunctionSelector, getFunctionSignature } from "@/lib/utils"
import { toast } from "sonner"
import { CopyPlus } from "lucide-react"
import { FetchTxModal } from "./FetchTxModal"
import type { Abi, AbiFunction } from "viem"

interface ImportCalldataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (inputs: Record<string, unknown>) => void
  abi: Abi
  functionName: string
}

export function ImportCalldataModal({
  open,
  onOpenChange,
  onImport,
  abi,
  functionName,
}: ImportCalldataModalProps) {
  const [calldata, setCalldata] = useState("")
  const [fetchModalOpen, setFetchModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setCalldata("")
      setError(null)
    }
  }, [open])

  const handleCalldataChange = (value: string) => {
    setCalldata(value)
    setError(null)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    if (pasted.trim()) {
      const cleaned = pasted.trim().startsWith("0x") ? pasted.trim() : `0x${pasted.trim()}`
      if (/^0x[0-9a-fA-F]+$/i.test(cleaned)) {
        setCalldata(cleaned)
        setError(null)
      } else {
        setError("Invalid hex format. Only hexadecimal characters (0-9, a-f, A-F) are allowed")
      }
    }
  }

  const handleCalldataFetched = (fetchedCalldata: string) => {
    setCalldata(fetchedCalldata)
    setError(null)
  }

  const validateFunctionSignature = (calldataBytes: string, abi: Abi, functionName: string): boolean => {
    try {
      const selector = extractFunctionSelector(calldataBytes)
      if (!selector) {
        return false
      }

      const func = (abi as any[]).find((item) => item.type === "function" && item.name === functionName)
      if (!func) {
        return false
      }

      const expectedSelector = getFunctionSignature(func as AbiFunction)
      return expectedSelector.toLowerCase() === selector.toLowerCase()
    } catch {
      return false
    }
  }

  const handleImport = () => {
    setError(null)

    if (!calldata.trim()) {
      toast.error("Calldata required")
      return
    }

    const cleaned = calldata.trim().startsWith("0x") ? calldata.trim() : `0x${calldata.trim()}`
    
    if (!/^0x[0-9a-fA-F]+$/i.test(cleaned)) {
      setError("Invalid hex format. Only hexadecimal characters (0-9, a-f, A-F) are allowed")
      toast.error("Invalid hex format")
      return
    }

    if (!validateFunctionSignature(cleaned, abi, functionName)) {
      setError("Function signature mismatch. The calldata does not match this function's signature.")
      toast.error("Signature mismatch")
      return
    }

    try {
      const func = (abi as any[]).find((item) => item.type === "function" && item.name === functionName)
      if (!func) {
        throw new Error("Function not found in ABI")
      }

      const decoded = decodeFunctionData({
        abi: [func] as Abi,
        data: cleaned as `0x${string}`,
      })

      const formFields = generateFormFields([...func.inputs])
      const decodedInputs: Record<string, unknown> = {}

      formFields.forEach((field, index) => {
        if (decoded.args && decoded.args[index] !== undefined) {
          const value = decoded.args[index]
          if (typeof value === "bigint") {
            decodedInputs[field.name] = value.toString()
          } else if (Array.isArray(value)) {
            decodedInputs[field.name] = safeStringify(value)
          } else if (value !== null && typeof value === "object") {
            decodedInputs[field.name] = safeStringify(value)
          } else {
            decodedInputs[field.name] = value
          }
        }
      })

      onImport(decodedInputs)
      toast.success("Calldata imported")
      onOpenChange(false)
      setCalldata("")
      setError(null)
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : "Failed to decode calldata"
      
      if (errorMessage.toLowerCase().includes("out of bounds")) {
        errorMessage = `Function signature matches, but supplied calldata appears to be incorrect for this function.\n\n${errorMessage}`
      }
      
      setError(errorMessage)
      toast.error("Import failed")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Calldata Bytes</DialogTitle>
            <DialogDescription>
              Paste raw calldata bytes or fetch from an on-chain transaction
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="calldata-input">Calldata Bytes (hex)</Label>
              <div>
                <Button
                  variant="outline"
                  onClick={() => setFetchModalOpen(true)}
                >
                  <CopyPlus className="mr-2 h-4 w-4" />
                  Clone from Transaction
                </Button>
              </div>
              <Textarea
                id="calldata-input"
                placeholder="0x..."
                value={calldata}
                onChange={(e) => handleCalldataChange(e.target.value)}
                onPaste={handlePaste}
                className="font-mono min-h-[120px]"
              />
              {error && (
                <div className="flex items-start gap-2 text-sm whitespace-pre-line" style={{ color: '#ec4899' }}>
                  <span className="flex-shrink-0 mt-0.5">×</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!calldata.trim() || !!error}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FetchTxModal
        open={fetchModalOpen}
        onOpenChange={setFetchModalOpen}
        onCalldataFetched={handleCalldataFetched}
      />
    </>
  )
}

