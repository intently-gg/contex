import { useState, useEffect, useMemo, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseUnits, formatUnits } from "viem"
import { toast } from "sonner"
import { Copy, Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { copyToClipboard } from "@/lib/utils"

interface ValueParserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: (value: string) => void
  fieldName: string
  fieldType: string
  currentValue?: string
  contractLabel?: string
  address?: string
  functionName?: string
  disconnected?: boolean // If true, show Copy button instead of Apply
}

// In-memory storage for decimals per parameter
const decimalsMemory: Record<string, string> = {}

function getMemoryKey(contractLabel: string, address: string, functionName: string, fieldName: string): string {
  return `${contractLabel}:${address}:${functionName}:${fieldName}`
}

export function ValueParserModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  fieldType,
  currentValue = "",
  contractLabel = "",
  address = "",
  functionName = "",
  disconnected = false,
}: ValueParserModalProps) {
  const isWei = fieldType.toLowerCase().includes("wei") || fieldName.toLowerCase().includes("wei")
  const memoryKey = contractLabel && address && functionName 
    ? getMemoryKey(contractLabel, address, functionName, fieldName)
    : null
  
  // Initialize decimals from memory or default
  const [decimals, setDecimals] = useState(() => {
    if (memoryKey && decimalsMemory[memoryKey]) {
      return decimalsMemory[memoryKey]
    }
    return isWei ? "18" : "0"
  })
  const [units, setUnits] = useState("")
  const previewRef = useRef<HTMLDivElement>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // If currentValue exists and we have saved decimals, try to load it
      if (currentValue && memoryKey && decimalsMemory[memoryKey]) {
        try {
          const savedDecimals = Number.parseInt(decimalsMemory[memoryKey], 10)
          const parsedUnits = formatUnits(BigInt(currentValue), savedDecimals)
          setUnits(parsedUnits)
        } catch {
          // If parsing fails, reset to empty
          setUnits("")
        }
      } else {
        // If no currentValue, reset to empty (don't remember previous input)
        setUnits("")
      }
    } else {
      // When modal closes, reset units state
      setUnits("")
    }
  }, [open, currentValue, memoryKey])

  // Real-time preview calculation
  const preview = useMemo(() => {
    if (!units || !decimals) return null
    
    const decimalsNum = Number.parseInt(decimals, 10)
    const unitsNum = Number.parseFloat(units)

    if (Number.isNaN(decimalsNum) || Number.isNaN(unitsNum)) {
      return null
    }

    // Check if units exceed decimals
    const unitsStr = unitsNum.toString()
    const decimalPart = unitsStr.includes(".") ? unitsStr.split(".")[1] : ""
    if (decimalPart.length > decimalsNum) {
      return null // Invalid, don't show preview
    }

    try {
      const weiValue = parseUnits(unitsNum.toString(), decimalsNum)
      return weiValue.toString()
    } catch {
      return null
    }
  }, [units, decimals])

  const handlePreset = (presetDecimals: string) => {
    setDecimals(presetDecimals)
  }

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!preview) {
      toast.error("No preview value to copy")
      return
    }
    
    // Try modern clipboard API first
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(preview)
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
        toast.success("Copied to clipboard")
        return
      }
    } catch {
      // Fall through to Selection API fallback
    }
    
    // Fallback: Select from preview element using Selection API
    try {
      if (previewRef.current) {
        const range = document.createRange()
        range.selectNodeContents(previewRef.current)
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
          const successful = document.execCommand("copy")
          selection.removeAllRanges()
          
          if (successful) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
            toast.success("Copied to clipboard")
            return
          }
        }
      }
    } catch {
      // Fall through to error
    }
    
    toast.error("Failed to copy. Please select and copy manually.")
  }

  const handleApply = async () => {
    if (!units || !decimals) {
      toast.error("Please provide both decimals and units")
      return
    }

    const decimalsNum = Number.parseInt(decimals, 10)
    const unitsNum = Number.parseFloat(units)

    if (Number.isNaN(decimalsNum) || Number.isNaN(unitsNum)) {
      toast.error("Invalid number format")
      return
    }

    // Check if units exceed decimals
    const unitsStr = unitsNum.toString()
    const decimalPart = unitsStr.includes(".") ? unitsStr.split(".")[1] : ""
    if (decimalPart.length > decimalsNum) {
      toast.error(
        `Units have ${decimalPart.length} decimal places, but only ${decimalsNum} decimals are allowed`
      )
      return
    }

    try {
      const weiValue = parseUnits(unitsNum.toString(), decimalsNum)
      const result = weiValue.toString()
      
      // Save decimals to memory
      if (memoryKey) {
        decimalsMemory[memoryKey] = decimals
      }
      
      if (disconnected) {
        // Copy to clipboard instead of applying
        const success = await copyToClipboard(result)
        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1000)
          toast.success("Copied to clipboard")
        } else {
          toast.error("Failed to copy to clipboard")
        }
      } else if (onApply) {
        onApply(result)
        onOpenChange(false)
        setUnits("")
      }
    } catch (error) {
      toast.error("Failed to parse value", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Value Helper</DialogTitle>
          <DialogDescription>
            Parse {fieldName} ({fieldType}) value from decimals and units
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="units">Units</Label>
            <Input
              id="units"
              type="number"
              step="any"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="12.345"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Example: 12.345 with 6 decimals = 12345000
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="decimals">Decimals</Label>
            <div className="flex gap-2">
              <Input
                id="decimals"
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                placeholder={isWei ? "18" : "0"}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("6")}
              >
                6
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("8")}
              >
                8
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("18")}
              >
                18
              </Button>
            </div>
            {isWei && (
              <p className="text-xs text-muted-foreground">
                Default: 18 (for wei/ether). You can override this.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            {preview ? (
              <div className="flex items-center gap-2">
                <div 
                  ref={previewRef}
                  className="rounded-md bg-muted p-3 text-sm border flex-1 font-mono select-all cursor-text"
                  onClick={(e) => {
                    // Allow text selection on click
                    const range = document.createRange()
                    range.selectNodeContents(e.currentTarget)
                    const selection = window.getSelection()
                    if (selection) {
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  }}
                >
                  {preview}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
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
              </div>
            ) : (
              <div className="rounded-md bg-muted p-3 text-sm border flex-1 font-mono min-h-[42px] flex items-center text-muted-foreground">
                Enter values to see preview
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!disconnected && (
            <Button onClick={handleApply}>Apply</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
