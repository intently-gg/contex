import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Eye, EyeOff } from "lucide-react"
import { InputControl } from "@/components/shared/InputControl"
import { ResultRenderer } from "@/components/shared/ResultRenderer"
import { ValueParserModal } from "./ValueParserModal"
import { AddressHelperModal } from "./AddressHelperModal"
import { parseTupleValue, serializeTupleAsArray, tupleToArray } from "@/lib/tupleParser"
import { needsValueParser } from "@/lib/formGenerator"
import { useChainId } from "wagmi"
import { toast } from "sonner"
import type { AbiParameter } from "viem"
import { cn } from "@/lib/utils"

const NO_COMPONENTS: readonly AbiParameter[] = []

function loadTupleValuesFromCurrent(
  currentValue: string,
  components: readonly AbiParameter[]
): Record<string, unknown> {
  if (!currentValue) {
    return {}
  }
  try {
    const arrayParsed = JSON.parse(currentValue)
    if (Array.isArray(arrayParsed) && arrayParsed.length === components.length) {
      const tuple: Record<string, unknown> = {}
      components.forEach((comp: AbiParameter, index: number) => {
        const name = comp.name || `param_${index}`
        tuple[name] = arrayParsed[index]
      })
      return tuple
    }
  } catch {
    // fall through
  }

  const parsed = parseTupleValue(currentValue, components)
  if (parsed && Object.keys(parsed).length > 0) {
    const allPresent = components.every((comp: AbiParameter) => {
      const name = comp.name || ""
      return parsed[name] !== undefined
    })
    if (allPresent) {
      return parsed
    }
  }

  toast.warning("Could not parse current value", {
    description: "The parameter's current value did not appear to be valid and could not be loaded into the helper.",
  })
  return {}
}

export type TupleHelperVariant = "inline" | "modal"

export interface TupleHelperProps {
  fieldName: string
  abiParam: AbiParameter
  currentValue: string
  /** When false, external value sync is paused (e.g. modal closed). */
  active: boolean
  variant: TupleHelperVariant
  /** Inline: push serialized tuple into parent state whenever values change. */
  onLiveChange?: (serialized: string) => void
  /** Modal: invoked with serialized value when user confirms. */
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

export function TupleHelper({
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
}: TupleHelperProps) {
  const chainId = useChainId()
  const components =
    (abiParam as { components?: readonly AbiParameter[] }).components ?? NO_COMPONENTS
  /** Inline: skip reloading from parent when this matches `currentValue` (avoids clobbering local edits). */
  const lastEmittedSerializedRef = useRef<string | null>(null)
  const onLiveChangeRef = useRef(onLiveChange)
  onLiveChangeRef.current = onLiveChange

  const [tupleValues, setTupleValues] = useState<Record<string, unknown>>({})

  const [valueParserOpen, setValueParserOpen] = useState<{
    fieldName: string
    fieldType: string
    currentValue: string
  } | null>(null)
  const [addressHelperOpen, setAddressHelperOpen] = useState<{
    fieldName: string
    abiParam: AbiParameter
  } | null>(null)
  const [inlinePreviewVisible, setInlinePreviewVisible] = useState(false)

  useLayoutEffect(() => {
    if (!active) {
      return
    }
    if (variant === "modal") {
      lastEmittedSerializedRef.current = null
      if (currentValue) {
        setTupleValues(loadTupleValuesFromCurrent(currentValue, components))
      } else {
        setTupleValues({})
      }
      return
    }
    if (currentValue === lastEmittedSerializedRef.current) {
      return
    }
    lastEmittedSerializedRef.current = null
    setTupleValues(loadTupleValuesFromCurrent(currentValue, components))
  }, [active, currentValue, components, variant])

  useEffect(() => {
    if (variant !== "inline" || !active) {
      return
    }
    const cb = onLiveChangeRef.current
    if (!cb) {
      return
    }
    try {
      const serialized = serializeTupleAsArray(tupleValues, components)
      lastEmittedSerializedRef.current = serialized
      if (serialized === currentValue) {
        return
      }
      cb(serialized)
    } catch {
      // incomplete / invalid — wait for valid tuple
    }
  }, [tupleValues, variant, active, components, currentValue])

  const preview = useMemo(() => {
    try {
      return tupleToArray(tupleValues, components)
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
        currentValue: String(tupleValues[compName] || ""),
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
      onTupleHelper(compName, comp, String(tupleValues[compName] || ""))
    }
  }

  const handleListHelper = (compName: string, comp: AbiParameter) => {
    if (onListHelper) {
      onListHelper(compName, comp, String(tupleValues[compName] || ""))
    }
  }

  const handleAddressHelper = (compName: string, param: AbiParameter) => {
    setAddressHelperOpen({ fieldName: compName, abiParam: param })
  }

  const handleAddressHelperApply = (value: string) => {
    if (addressHelperOpen !== null) {
      handleFieldChange(addressHelperOpen.fieldName, value)
      setAddressHelperOpen(null)
    }
  }

  const handleModalApply = () => {
    try {
      const serialized = serializeTupleAsArray(tupleValues, components)
      onApply?.(serialized)
    } catch (error) {
      toast.error("Failed to serialize tuple", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const structDisplayName = useMemo(() => {
    const fieldType = abiParam.type
    const isTupleShape =
      fieldType === "tuple" || fieldType === "tuple[]" || fieldType.startsWith("tuple[")
    if (!isTupleShape || !abiParam.internalType || typeof abiParam.internalType !== "string") {
      return null
    }
    return abiParam.internalType.replace(/^struct\s+/i, "")
  }, [abiParam])

  const showPreviewColumn = variant === "modal" || (variant === "inline" && inlinePreviewVisible)

  const gridClass =
    variant === "modal"
      ? "grid grid-cols-[calc(50%-0.5rem+75px)_minmax(0,1fr)] gap-4 flex-1 min-h-0 overflow-hidden"
      : showPreviewColumn
        ? "grid grid-cols-1 md:grid-cols-[calc(50%-0.5rem+75px)_minmax(0,1fr)] gap-4"
        : "grid grid-cols-1 gap-4"

  const leftColClass =
    variant === "modal"
      ? "space-y-2 overflow-y-auto pr-2 min-h-0"
      : "space-y-2 pr-2"
  const rightColClass =
    variant === "modal" ? "space-y-2 overflow-y-auto min-h-0" : "space-y-2"

  return (
    <div className={cn(variant === "inline" && "bg-tuple-helper-nest", className)}>
      {variant === "inline" && (
        <div className="space-y-1 mb-2">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <Label htmlFor={fieldName} className="text-sm min-w-0 flex-1">
              {fieldName}{" "}
              <span style={{ color: "hsl(var(--muted-foreground))" }}>({abiParam.type})</span>
            </Label>
            {!structDisplayName ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 transition-colors hover:bg-accent hover:border-accent/60"
                    onClick={() => setInlinePreviewVisible((v) => !v)}
                    aria-pressed={inlinePreviewVisible}
                  >
                    {inlinePreviewVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {inlinePreviewVisible ? "Hide preview" : "Show preview"}
                </TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 transition-colors hover:bg-accent hover:border-accent/60"
                    onClick={() => setInlinePreviewVisible((v) => !v)}
                    aria-pressed={inlinePreviewVisible}
                  >
                    {inlinePreviewVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {inlinePreviewVisible ? "Hide preview" : "Show preview"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      )}

      <div className={variant === "modal" ? "flex flex-col flex-1 min-h-0 overflow-hidden" : ""}>
        <div className={gridClass}>
          <div className={leftColClass}>
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
                  onValueHelper={
                    needsValueParser(compName, comp.type) ? () => handleValueHelper(compName) : undefined
                  }
                  onTupleHelper={onTupleHelper ? (name, param) => handleTupleHelper(name, param) : undefined}
                  onListHelper={onListHelper ? (name, param) => handleListHelper(name, param) : undefined}
                  onBytesHelper={
                    onBytesHelper
                      ? (name, param) => {
                          const n = name
                          onBytesHelper(n, param, String(tupleValues[n] || ""))
                        }
                      : undefined
                  }
                  onAddressHelper={
                    comp.type === "address" || comp.type === "bytes32"
                      ? (name, param) => handleAddressHelper(name, param)
                      : undefined
                  }
                />
              )
            })}
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
              {preview ? (
                <ResultRenderer value={preview} abiParam={abiParam} minHeight={200} />
              ) : (
                <div className="text-muted-foreground text-sm h-32 flex items-center justify-center border rounded-md">
                  Configure tuple values to see preview
                </div>
              )}
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

      {components.map((comp: AbiParameter, index: number) => {
        const compName = comp.name || `param_${index}`
        if (needsValueParser(compName, comp.type)) {
          return (
            <ValueParserModal
              key={`value-${compName}`}
              open={valueParserOpen?.fieldName === compName}
              onOpenChange={(open) =>
                setValueParserOpen(
                  open
                    ? {
                        fieldName: compName,
                        fieldType: comp.type,
                        currentValue: String(tupleValues[compName] || ""),
                      }
                    : null
                )
              }
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
      {addressHelperOpen && (
        <AddressHelperModal
          open={!!addressHelperOpen}
          onOpenChange={(open) => setAddressHelperOpen(open ? addressHelperOpen : null)}
          onApply={handleAddressHelperApply}
          fieldName={addressHelperOpen.fieldName}
          fieldType={addressHelperOpen.abiParam.type === "bytes32" ? "bytes32" : "address"}
          chainId={chainId}
        />
      )}
    </div>
  )
}
