import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { InputControl } from "@/components/shared/InputControl"
import { ResultRenderer } from "@/components/shared/ResultRenderer"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import { AddressHelperModal } from "./AddressHelperModal"
import { BytesHelperModal } from "./BytesHelperModal"
import { parseListValue, serializeListValue } from "@/lib/tupleParser"
import { getBaseType, isListType, isTupleType, needsValueParser } from "@/lib/formGenerator"
import { useChainId } from "wagmi"
import { toast } from "sonner"
import type { AbiParameter } from "viem"
import { cn } from "@/lib/utils"

function loadListFromCurrent(currentValue: string): unknown[] {
  if (!currentValue || currentValue.trim() === "") {
    return []
  }
  try {
    const parsed = parseListValue(currentValue)
    if (parsed !== null && Array.isArray(parsed)) {
      return parsed
    }
    throw new Error("Invalid array format")
  } catch {
    toast.warning("Could not parse current value", {
      description:
        "The parameter's current value did not appear to be valid and could not be loaded into the helper.",
    })
    return []
  }
}

export type ListHelperVariant = "inline" | "modal"

export interface ListHelperProps {
  fieldName: string
  abiParam: AbiParameter
  currentValue: string
  active: boolean
  variant: ListHelperVariant
  onLiveChange?: (serialized: string) => void
  onApply?: (serialized: string) => void
  onModalCancel?: () => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  abiKey?: string
  address?: string
  functionName?: string
  className?: string
}

export function ListHelper({
  fieldName,
  abiParam,
  currentValue,
  active,
  variant,
  onLiveChange,
  onApply,
  onModalCancel,
  onTupleHelper,
  onListHelper,
  onBytesHelper,
  abiKey,
  address,
  functionName,
  className,
}: ListHelperProps) {
  const chainId = useChainId()
  const baseType = getBaseType(abiParam.type)
  const isTuple = isTupleType(baseType)
  const tupleComponents =
    isTuple && (abiParam as { components?: AbiParameter[] }).components
      ? (abiParam as { components: AbiParameter[] }).components
      : null

  const lastEmittedSerializedRef = useRef<string | null>(null)
  const onLiveChangeRef = useRef(onLiveChange)
  onLiveChangeRef.current = onLiveChange

  const [listValues, setListValues] = useState<unknown[]>([])
  const [valueParserOpen, setValueParserOpen] = useState<{
    index: number
    fieldType: string
    currentValue: string
  } | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{
    index: number
    abiParam: AbiParameter
    currentValue: string
  } | null>(null)
  const [addressHelperOpen, setAddressHelperOpen] = useState<{
    index: number
    abiParam: AbiParameter
  } | null>(null)
  const [bytesHelperOpen, setBytesHelperOpen] = useState<{
    index: number
    abiParam: AbiParameter
  } | null>(null)
  const [nestedListHelperOpen, setNestedListHelperOpen] = useState<{
    index: number
    abiParam: AbiParameter
    currentValue: string
  } | null>(null)
  const [inlinePreviewVisible, setInlinePreviewVisible] = useState(false)

  const structDisplayName = useMemo(() => {
    if (!isTuple) return null
    if (!abiParam.internalType || typeof abiParam.internalType !== "string") return null
    return abiParam.internalType
      .replace(/^struct\s+/i, "")
      .replace(/\[\]$/, "")
      .trim()
  }, [isTuple, abiParam])

  useLayoutEffect(() => {
    if (!active) return
    if (variant === "modal") {
      lastEmittedSerializedRef.current = null
      if (currentValue) {
        setListValues(loadListFromCurrent(currentValue))
      } else {
        setListValues([])
      }
      return
    }
    if (currentValue === lastEmittedSerializedRef.current) {
      return
    }
    lastEmittedSerializedRef.current = null
    setListValues(loadListFromCurrent(currentValue))
  }, [active, currentValue, variant])

  useEffect(() => {
    if (variant !== "inline" || !active) return
    const cb = onLiveChangeRef.current
    if (!cb) return
    try {
      const serialized = serializeListValue(listValues)
      lastEmittedSerializedRef.current = serialized
      if (serialized === currentValue) return
      cb(serialized)
    } catch {
      // wait for valid list
    }
  }, [listValues, variant, active, currentValue])

  const preview = useMemo(() => listValues, [listValues])

  const handleAddItem = () => {
    setListValues((prev) => [...prev, ""])
  }

  const handleRemoveItem = (index: number) => {
    setListValues((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, value: unknown) => {
    setListValues((prev) => {
      const newList = [...prev]
      if (isTuple && typeof value === "string" && value.trim() !== "") {
        try {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed)) {
            newList[index] = parsed
            return newList
          }
        } catch {
          // keep string
        }
      }
      newList[index] = value
      return newList
    })
  }

  const handleValueHelper = (index: number) => {
    setValueParserOpen({
      index,
      fieldType: baseType,
      currentValue: String(listValues[index] || ""),
    })
  }

  const handleValueParserApply = (value: string) => {
    if (valueParserOpen !== null) {
      handleItemChange(valueParserOpen.index, value)
      setValueParserOpen(null)
    }
  }

  const handleTupleHelper = (index: number, comp: AbiParameter) => {
    if (tupleComponents) {
      const value = listValues[index]
      const cv =
        value === undefined || value === null
          ? ""
          : typeof value === "string"
            ? value
            : JSON.stringify(value)
      setTupleHelperOpen({ index, abiParam: comp, currentValue: cv })
    }
  }

  const handleTupleHelperApply = (index: number, value: string) => {
    try {
      const parsed = JSON.parse(value)
      handleItemChange(index, parsed)
    } catch {
      handleItemChange(index, value)
    }
    setTupleHelperOpen(null)
  }

  const handleNestedListHelper = (index: number, comp: AbiParameter) => {
    setNestedListHelperOpen({
      index,
      abiParam: comp,
      currentValue: String(listValues[index] || ""),
    })
  }

  const handleAddressHelper = (index: number, param: AbiParameter) => {
    setAddressHelperOpen({ index, abiParam: param })
  }

  const handleAddressHelperApply = (value: string) => {
    if (addressHelperOpen !== null) {
      handleItemChange(addressHelperOpen.index, value)
      setAddressHelperOpen(null)
    }
  }

  const handleModalApply = () => {
    try {
      const serialized = serializeListValue(listValues)
      onApply?.(serialized)
    } catch (error) {
      toast.error("Failed to serialize list", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

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

  const showPreviewColumn = variant === "modal" || (variant === "inline" && inlinePreviewVisible)

  const gridClass =
    variant === "modal"
      ? "grid grid-cols-[50%_50%] gap-4 flex-1 min-h-0 overflow-hidden"
      : showPreviewColumn
        ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4"
        : "grid grid-cols-1 gap-4"

  const leftColClass =
    variant === "modal" ? "space-y-2 overflow-y-auto pr-2 min-h-0" : "space-y-2 pr-2"
  const rightColClass = variant === "modal" ? "space-y-2 overflow-y-auto min-h-0" : "space-y-2"

  const previewToggleButton = (show: boolean, onToggle: () => void) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 transition-colors hover:bg-accent hover:border-accent/60"
          onClick={onToggle}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{show ? "Hide preview" : "Show preview"}</TooltipContent>
    </Tooltip>
  )

  return (
    <div className={cn(variant === "inline" && "bg-tuple-helper-nest", className)}>
      {variant === "inline" && (
        <div className="space-y-1 mb-2">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <Label htmlFor={fieldName} className="text-sm min-w-0 flex-1">
              {fieldName}{" "}
              <span style={{ color: "hsl(var(--muted-foreground))" }}>({abiParam.type})</span>
            </Label>
            {!structDisplayName ? previewToggleButton(inlinePreviewVisible, () =>
              setInlinePreviewVisible((v) => !v)
            ) : null}
          </div>
          {structDisplayName ? (
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div
                className="text-xs truncate min-w-0 flex-1"
                style={{ color: "#60a5fa" }}
                title={`Struct: ${structDisplayName}`}
              >
                Struct: {structDisplayName}
              </div>
              {previewToggleButton(inlinePreviewVisible, () => setInlinePreviewVisible((v) => !v))}
            </div>
          ) : null}
        </div>
      )}

      <div className={variant === "modal" ? "flex flex-col flex-1 min-h-0 overflow-hidden" : ""}>
        <div className={gridClass}>
          <div className={leftColClass}>
            {listValues.map((value, index) => {
              const itemParam = createItemParam()
              const itemName = `item_${index}`
              return (
                <div key={index} className="border rounded-md p-2 space-y-1 border-border bg-background/40">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <InputControl
                        fieldName={itemName}
                        fieldType={baseType}
                        abiParam={itemParam}
                        value={value}
                        onChange={(val) => handleItemChange(index, val)}
                        onValueHelper={
                          needsValueParser(itemName, baseType)
                            ? () => handleValueHelper(index)
                            : undefined
                        }
                        onTupleHelper={isTuple ? (_name, param) => handleTupleHelper(index, param) : undefined}
                        onListHelper={
                          isListType(itemParam.type)
                            ? (_name, param) => handleNestedListHelper(index, param)
                            : undefined
                        }
                        onBytesHelper={
                          baseType === "bytes"
                            ? (_name, param) => setBytesHelperOpen({ index, abiParam: param })
                            : onBytesHelper
                              ? (_name, param) => {
                                  onBytesHelper(_name, param, String(listValues[index] || ""))
                                }
                              : undefined
                        }
                        onAddressHelper={
                          baseType === "address" || baseType === "bytes32"
                            ? (_name, param) => handleAddressHelper(index, param)
                            : undefined
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 mt-6"
                      onClick={() => handleRemoveItem(index)}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
            <Button variant="outline" onClick={handleAddItem} className="w-full" type="button">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
          {showPreviewColumn ? (
            <div className={rightColClass}>
              <div
                className={
                  variant === "modal"
                    ? "sticky top-0 bg-background pb-2 z-10"
                    : "bg-background pb-2"
                }
              >
                <h4 className="text-sm font-medium">Preview</h4>
              </div>
              <ResultRenderer value={preview} abiParam={isTuple ? abiParam : undefined} minHeight={200} />
            </div>
          ) : null}
        </div>
      </div>

      {variant === "modal" && (
        <DialogFooter className="mt-4 flex-shrink-0">
          <Button variant="outline" onClick={onModalCancel}>
            Cancel
          </Button>
          <Button onClick={handleModalApply}>Apply</Button>
        </DialogFooter>
      )}

      {listValues.map((_, index) => {
        const itemName = `item_${index}`
        if (needsValueParser(itemName, baseType)) {
          return (
            <ValueParserModal
              key={`value-${index}`}
              open={valueParserOpen?.index === index}
              onOpenChange={(open) =>
                setValueParserOpen(
                  open
                    ? {
                        index,
                        fieldType: baseType,
                        currentValue: String(listValues[index] || ""),
                      }
                    : null
                )
              }
              onApply={handleValueParserApply}
              fieldName={itemName}
              fieldType={baseType}
              currentValue={String(listValues[index] || "")}
              abiKey={abiKey}
              address={address}
              functionName={functionName}
            />
          )
        }
        return null
      })}
      {tupleHelperOpen && (
        <TupleHelperModal
          open={!!tupleHelperOpen}
          onOpenChange={(open) => setTupleHelperOpen(open ? tupleHelperOpen : null)}
          onApply={(value) => handleTupleHelperApply(tupleHelperOpen.index, value)}
          fieldName={`item_${tupleHelperOpen.index}`}
          abiParam={tupleHelperOpen.abiParam}
          currentValue={tupleHelperOpen.currentValue}
          onTupleHelper={
            onTupleHelper
              ? (_name, param, val) => {
                  setTupleHelperOpen({
                    index: tupleHelperOpen.index,
                    abiParam: param,
                    currentValue: val || "",
                  })
                }
              : undefined
          }
          onListHelper={
            onListHelper
              ? (_name, param, val) => {
                  onListHelper(_name, param, val)
                }
              : undefined
          }
          onBytesHelper={
            onBytesHelper
              ? (_name, param, currentValue) => {
                  onBytesHelper(_name, param, currentValue)
                }
              : undefined
          }
          abiKey={abiKey}
          address={address}
          functionName={functionName}
        />
      )}
      {addressHelperOpen && (
        <AddressHelperModal
          open={!!addressHelperOpen}
          onOpenChange={(open) => setAddressHelperOpen(open ? addressHelperOpen : null)}
          onApply={handleAddressHelperApply}
          fieldName={`item_${addressHelperOpen.index}`}
          fieldType={addressHelperOpen.abiParam.type === "bytes32" ? "bytes32" : "address"}
          chainId={chainId}
        />
      )}
      {bytesHelperOpen && (
        <BytesHelperModal
          open={!!bytesHelperOpen}
          onOpenChange={(open) => setBytesHelperOpen(open ? bytesHelperOpen : null)}
          onApply={(value) => handleItemChange(bytesHelperOpen.index, value)}
          fieldName={`item_${bytesHelperOpen.index}`}
          abiParam={bytesHelperOpen.abiParam}
          currentValue={String(listValues[bytesHelperOpen.index] ?? "")}
          onTupleHelper={onTupleHelper}
          onListHelper={onListHelper}
          onBytesHelper={onBytesHelper}
          abiKey={abiKey}
          address={address}
          functionName={functionName}
        />
      )}
      {nestedListHelperOpen && (
        <ListHelperModal
          open={!!nestedListHelperOpen}
          onOpenChange={(open) => setNestedListHelperOpen(open ? nestedListHelperOpen : null)}
          onApply={(serialized) => handleItemChange(nestedListHelperOpen.index, serialized)}
          fieldName={`item_${nestedListHelperOpen.index}`}
          abiParam={nestedListHelperOpen.abiParam}
          currentValue={nestedListHelperOpen.currentValue}
          onTupleHelper={onTupleHelper}
          onListHelper={onListHelper}
          onBytesHelper={onBytesHelper}
          abiKey={abiKey}
          address={address}
          functionName={functionName}
        />
      )}
    </div>
  )
}
