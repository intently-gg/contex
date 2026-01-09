import { useState, useEffect, useMemo } from "react"
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
import { ResultRenderer } from "@/components/shared/ResultRenderer"

interface ValueParserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  fieldType: string
  currentValue?: string
  contractLabel?: string
  address?: string
  functionName?: string
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

  // Try to load from current value if it hasn't changed
  useEffect(() => {
    if (open && currentValue && memoryKey && decimalsMemory[memoryKey]) {
      try {
        const savedDecimals = Number.parseInt(decimalsMemory[memoryKey], 10)
        const parsedUnits = formatUnits(BigInt(currentValue), savedDecimals)
        setUnits(parsedUnits)
      } catch {
        // If parsing fails, don't auto-populate
      }
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

  const handleApply = () => {
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
      
      onApply(result)
      onOpenChange(false)
      setUnits("")
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
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
              <Label htmlFor="units">Units</Label>
              <Input
                id="units"
                type="number"
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="12.345"
              />
              <p className="text-xs text-muted-foreground">
                Example: 12.345 with 6 decimals = 12345000
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            {preview ? (
              <ResultRenderer value={preview} />
            ) : (
              <div className="text-muted-foreground text-sm h-32 flex items-center justify-center border rounded-md">
                Enter values to see preview
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
