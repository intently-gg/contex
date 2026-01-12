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
import { parseListValue, serializeListValue } from "@/lib/tupleParser"
import { getBaseType, isTupleType, needsValueParser } from "@/lib/formGenerator"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import type { AbiParameter } from "viem"

interface ListHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  abiParam: AbiParameter
  currentValue?: string
  onValueHelper?: (fieldName: string, fieldType: string, currentValue?: string) => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  contractLabel?: string
  address?: string
  functionName?: string
}

export function ListHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  abiParam,
  currentValue = "",
  onValueHelper: _onValueHelper,
  onTupleHelper,
  onListHelper,
  contractLabel,
  address,
  functionName,
}: ListHelperModalProps) {
  const baseType = getBaseType(abiParam.type)
  const isTuple = isTupleType(baseType)
  
  // For tuple arrays, we need the tuple components
  const tupleComponents = isTuple && (abiParam as any).components ? (abiParam as any).components : null
  
  // Initialize list values
  const [listValues, setListValues] = useState<unknown[]>([])
  const [valueParserOpen, setValueParserOpen] = useState<{ index: number; fieldType: string; currentValue: string } | null>(null)

  // Try to load from current value
  useEffect(() => {
    if (open && currentValue) {
      try {
        const parsed = parseListValue(currentValue)
        if (parsed !== null && Array.isArray(parsed)) {
          // Validate it's a proper array
          setListValues(parsed)
        } else {
          throw new Error("Invalid array format")
        }
      } catch {
        toast.warning("Could not parse current value", {
          description: "The parameter's current value did not appear to be valid and could not be loaded into the helper.",
        })
        setListValues([])
      }
    } else if (open) {
      setListValues([])
    }
  }, [open, currentValue])

  // Real-time preview calculation
  const preview = useMemo(() => {
    return listValues
  }, [listValues])

  const handleAddItem = () => {
    setListValues((prev) => [...prev, ""])
  }

  const handleRemoveItem = (index: number) => {
    setListValues((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, value: unknown) => {
    setListValues((prev) => {
      const newList = [...prev]
      newList[index] = value
      return newList
    })
  }

  const handleValueHelper = (index: number) => {
    setValueParserOpen({
      index,
      fieldType: baseType,
      currentValue: String(listValues[index] || "")
    })
  }

  const handleValueParserApply = (value: string) => {
    if (valueParserOpen !== null) {
      handleItemChange(valueParserOpen.index, value)
      setValueParserOpen(null)
    }
  }

  const handleTupleHelper = (index: number, comp: AbiParameter) => {
    if (onTupleHelper && tupleComponents) {
      onTupleHelper(
        `item_${index}`,
        comp,
        String(listValues[index] || "")
      )
    }
  }

  const handleListHelper = (index: number, comp: AbiParameter) => {
    if (onListHelper) {
      onListHelper(
        `item_${index}`,
        comp,
        String(listValues[index] || "")
      )
    }
  }

  const handleApply = () => {
    try {
      const serialized = serializeListValue(listValues)
      onApply(serialized)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to serialize list", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Create a synthetic AbiParameter for each list item
  const createItemParam = (): AbiParameter => {
    if (isTuple && tupleComponents) {
      return {
        name: "",
        type: baseType,
        components: tupleComponents,
      }
    }
    return {
      name: "",
      type: baseType,
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>List Helper</DialogTitle>
          <DialogDescription>
            Configure {fieldName} list values
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[50%_50%] gap-4 flex-1 overflow-hidden">
          <div className="space-y-2 overflow-y-auto pr-2">
            {listValues.map((value, index) => {
              const itemParam = createItemParam()
              const itemName = `item_${index}`
              return (
                <div key={index} className="border rounded-md p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <InputControl
                    fieldName={itemName}
                    fieldType={baseType}
                    abiParam={itemParam}
                    value={value}
                    onChange={(val) => handleItemChange(index, val)}
                    onValueHelper={needsValueParser(itemName, baseType) ? () => handleValueHelper(index) : undefined}
                    onTupleHelper={onTupleHelper ? (_name, param) => handleTupleHelper(index, param) : undefined}
                    onListHelper={onListHelper ? (_name, param) => handleListHelper(index, param) : undefined}
                  />
                </div>
              )
            })}
            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
          <div className="space-y-2 overflow-y-auto">
            <div className="sticky top-0 bg-background pb-2 z-10">
              <h4 className="text-sm font-medium">Preview</h4>
            </div>
            <ResultRenderer value={preview} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
      {listValues.map((_, index) => {
        const itemName = `item_${index}`
        if (needsValueParser(itemName, baseType)) {
          return (
            <ValueParserModal
              key={`value-${index}`}
              open={valueParserOpen?.index === index}
              onOpenChange={(open) => setValueParserOpen(open ? { index, fieldType: baseType, currentValue: String(listValues[index] || "") } : null)}
              onApply={handleValueParserApply}
              fieldName={itemName}
              fieldType={baseType}
              currentValue={String(listValues[index] || "")}
              contractLabel={contractLabel}
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

