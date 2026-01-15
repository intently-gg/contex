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
import { InputControl } from "@/components/shared/InputControl"
import { ResultRenderer } from "@/components/shared/ResultRenderer"
import { ValueParserModal } from "./ValueParserModal"
import { parseTupleValue, serializeTupleAsArray, tupleToArray } from "@/lib/tupleParser"
import { needsValueParser } from "@/lib/formGenerator"
import { toast } from "sonner"
import type { AbiParameter } from "viem"

interface TupleHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  abiParam: AbiParameter
  currentValue?: string
  onValueHelper?: (fieldName: string, fieldType: string, currentValue?: string) => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  abiKey?: string
  address?: string
  functionName?: string
}

export function TupleHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  abiParam,
  currentValue = "",
  onValueHelper: _onValueHelper,
  onTupleHelper,
  onListHelper,
  onBytesHelper,
  abiKey,
  address,
  functionName,
}: TupleHelperModalProps) {
  const components = (abiParam as any).components || []
  
  // Initialize tuple values
  const [tupleValues, setTupleValues] = useState<Record<string, unknown>>({})
  const [valueParserOpen, setValueParserOpen] = useState<{ fieldName: string; fieldType: string; currentValue: string } | null>(null)

  // Try to load from current value
  useEffect(() => {
    if (open && currentValue) {
      try {
        // First try to parse as array (what we serialize to)
        const arrayParsed = JSON.parse(currentValue)
        if (Array.isArray(arrayParsed) && arrayParsed.length === components.length) {
          // Convert array back to tuple object
          const tuple: Record<string, unknown> = {}
          components.forEach((comp: AbiParameter, index: number) => {
            const name = comp.name || `param_${index}`
            tuple[name] = arrayParsed[index]
          })
          setTupleValues(tuple)
          return
        }
      } catch {
        // Not an array, try as object
      }
      
      // Try parsing as object
      const parsed = parseTupleValue(currentValue, components)
      if (parsed && Object.keys(parsed).length > 0) {
        // Validate all components are present
        const allPresent = components.every((comp: AbiParameter) => {
          const name = comp.name || ""
          return parsed[name] !== undefined
        })
        if (allPresent) {
          setTupleValues(parsed)
          return
        }
      }
      
      // If we get here, couldn't parse perfectly
      toast.warning("Could not parse current value", {
        description: "The parameter's current value did not appear to be valid and could not be loaded into the helper.",
      })
      setTupleValues({})
    } else if (open) {
      setTupleValues({})
    }
  }, [open, currentValue, components])

  // Real-time preview calculation
  const preview = useMemo(() => {
    try {
      const arrayValue = tupleToArray(tupleValues, components)
      return arrayValue
    } catch {
      return null
    }
  }, [tupleValues, components])

  const handleFieldChange = (compName: string, value: unknown) => {
    setTupleValues((prev) => ({
      ...prev,
      [compName]: value,
    }))
  }

  const handleValueHelper = (compName: string) => {
    const comp = components.find((c: AbiParameter) => (c.name || "") === compName)
    if (comp) {
      setValueParserOpen({
        fieldName: compName,
        fieldType: comp.type,
        currentValue: String(tupleValues[compName] || "")
      })
    }
  }

  const handleValueParserApply = (value: string) => {
    if (valueParserOpen) {
      handleFieldChange(valueParserOpen.fieldName, value)
      setValueParserOpen(null)
    }
  }

  const handleTupleHelper = (compName: string, comp: AbiParameter) => {
    if (onTupleHelper) {
      onTupleHelper(
        compName,
        comp,
        String(tupleValues[compName] || "")
      )
    }
  }

  const handleListHelper = (compName: string, comp: AbiParameter) => {
    if (onListHelper) {
      onListHelper(
        compName,
        comp,
        String(tupleValues[compName] || "")
      )
    }
  }

  const handleApply = () => {
    try {
      const serialized = serializeTupleAsArray(tupleValues, components)
      onApply(serialized)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to serialize tuple", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tuple Helper</DialogTitle>
          <DialogDescription>
            Configure {fieldName} tuple values
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[50%_50%] gap-4 flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto pr-2">
            {components.map((comp: AbiParameter, index: number) => {
              const compName = comp.name || `param_${index}`
              return (
                <InputControl
                  key={compName}
                  fieldName={compName}
                  fieldType={comp.type}
                  abiParam={comp}
                  value={tupleValues[compName] ?? ""}
                  onChange={(value) => handleFieldChange(compName, value)}
                  onValueHelper={needsValueParser(compName, comp.type) ? () => handleValueHelper(compName) : undefined}
                  onTupleHelper={onTupleHelper ? (name, param) => handleTupleHelper(name, param) : undefined}
                  onListHelper={onListHelper ? (name, param) => handleListHelper(name, param) : undefined}
                  onBytesHelper={onBytesHelper ? (name, param) => {
                    const compName = name
                    onBytesHelper(compName, param, String(tupleValues[compName] || ""))
                  } : undefined}
                />
              )
            })}
          </div>
          <div className="space-y-2 overflow-y-auto">
            <div className="sticky top-0 bg-background pb-2 z-10">
              <h4 className="text-sm font-medium">Preview</h4>
            </div>
            {preview ? (
              <ResultRenderer value={preview} abiParam={abiParam} />
            ) : (
              <div className="text-muted-foreground text-sm h-32 flex items-center justify-center border rounded-md">
                Configure tuple values to see preview
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
      {components.map((comp: AbiParameter, index: number) => {
        const compName = comp.name || `param_${index}`
        if (needsValueParser(compName, comp.type)) {
          return (
            <ValueParserModal
              key={`value-${compName}`}
              open={valueParserOpen?.fieldName === compName}
              onOpenChange={(open) => setValueParserOpen(open ? { fieldName: compName, fieldType: comp.type, currentValue: String(tupleValues[compName] || "") } : null)}
              onApply={handleValueParserApply}
              fieldName={compName}
              fieldType={comp.type}
              currentValue={String(tupleValues[compName] || "")}
              abiKey={abiKey}
              address={address}
              functionName={functionName}
            />
          )
        }
        return null
      })}
    </Dialog>
  )
}

