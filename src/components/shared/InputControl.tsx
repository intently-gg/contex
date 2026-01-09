import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles } from "lucide-react"
import { needsValueParser, isTupleType, isListType } from "@/lib/formGenerator"
import type { AbiParameter } from "viem"

interface InputControlProps {
  fieldName: string
  fieldType: string
  abiParam: AbiParameter
  value: unknown
  onChange: (value: unknown) => void
  onValueHelper?: (fieldName: string) => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter) => void
  className?: string
}

export function InputControl({
  fieldName,
  fieldType,
  abiParam,
  value,
  onChange,
  onValueHelper,
  onTupleHelper,
  onListHelper,
  className,
}: InputControlProps) {
  const isArray = isListType(fieldType)
  const isTuple = isTupleType(fieldType)
  const needsValueParserHelper = needsValueParser(fieldName, fieldType)
  const needsTupleHelper = isTuple && onTupleHelper
  const needsListHelper = isArray && onListHelper

  const renderInput = () => {
    if (fieldType === "bool") {
      return (
        <div className="flex items-center space-x-2 flex-1">
          <Checkbox
            id={fieldName}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={fieldName} className="text-sm">
            {String(value || "false")}
          </Label>
        </div>
      )
    }

    const isBytes = fieldType.includes("bytes")
    
    if (isBytes && fieldType !== "bytes") {
      return (
        <Textarea
          id={fieldName}
          placeholder={`Hex string for ${fieldType}`}
          value={String(value || "")}
          onChange={(e) => {
            const val = e.target.value
            // Allow typing: start with 0x, then only hex chars
            if (val === "") {
              onChange("")
            } else if (val === "0" || val === "0x") {
              onChange(val)
            } else if (val.startsWith("0x") && /^0x[0-9a-fA-F]*$/.test(val)) {
              onChange(val)
            } else if (!val.startsWith("0x") && /^[0-9a-fA-F]*$/.test(val)) {
              // Auto-add 0x prefix if user types hex without it
              onChange("0x" + val)
            }
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData("text")
            // Validate pasted content is hex
            if (pasted === "" || /^0x[0-9a-fA-F]*$/i.test(pasted) || /^[0-9a-fA-F]*$/i.test(pasted)) {
              const cleaned = pasted.startsWith("0x") ? pasted : "0x" + pasted
              onChange(cleaned)
            }
          }}
          className="flex-1 font-mono"
        />
      )
    }

    if (fieldType === "bytes") {
      return (
        <Textarea
          id={fieldName}
          placeholder="0x..."
          value={String(value || "")}
          onChange={(e) => {
            const val = e.target.value
            // Allow typing: start with 0x, then only hex chars
            if (val === "") {
              onChange("")
            } else if (val === "0" || val === "0x") {
              onChange(val)
            } else if (val.startsWith("0x") && /^0x[0-9a-fA-F]*$/.test(val)) {
              onChange(val)
            } else if (!val.startsWith("0x") && /^[0-9a-fA-F]*$/.test(val)) {
              // Auto-add 0x prefix if user types hex without it
              onChange("0x" + val)
            }
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData("text")
            // Validate pasted content is hex
            if (pasted === "" || /^0x[0-9a-fA-F]*$/i.test(pasted) || /^[0-9a-fA-F]*$/i.test(pasted)) {
              const cleaned = pasted.startsWith("0x") ? pasted : "0x" + pasted
              onChange(cleaned)
            }
          }}
          className="flex-1 font-mono"
        />
      )
    }

    if (fieldType === "string") {
      return (
        <Textarea
          id={fieldName}
          placeholder=""
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      )
    }

    // For arrays/lists, use textarea to allow JSON editing
    if (isArray) {
      const baseType = fieldType.replace("[]", "")
      let placeholder = `JSON array, e.g. ["value1", "value2"]`
      
      if (baseType.includes("bytes")) {
        placeholder = `Array of bytes, e.g. ["0x123...", "0xABC..."]`
      } else if (baseType === "address") {
        placeholder = `Array of addresses, e.g. ["0x123...", "0xABC..."]`
      } else if (baseType.startsWith("uint") || baseType.startsWith("int")) {
        placeholder = `Array of numbers, e.g. [1, 2, 3]`
      } else if (baseType === "string") {
        placeholder = `Array of strings, e.g. ["value1", "value2"]`
      } else if (baseType.startsWith("tuple")) {
        placeholder = "Recommended to use the helper →"
      }
      
      return (
        <Textarea
          id={fieldName}
          placeholder={placeholder}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          rows={3}
        />
      )
    }

    if (fieldType === "address") {
      return (
        <Input
          id={fieldName}
          type="text"
          placeholder="0x..."
          value={String(value || "")}
          onChange={(e) => {
            const val = e.target.value
            // Allow typing: start with 0x, then only hex chars
            if (val === "") {
              onChange("")
            } else if (val === "0" || val === "0x") {
              onChange(val)
            } else if (val.startsWith("0x") && /^0x[0-9a-fA-F]*$/.test(val) && val.length <= 42) {
              onChange(val)
            } else if (!val.startsWith("0x") && /^[0-9a-fA-F]*$/.test(val) && val.length <= 40) {
              // Auto-add 0x prefix if user types hex without it
              onChange("0x" + val)
            }
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData("text").trim()
            // Validate pasted content is hex address
            if (pasted === "" || /^0x[0-9a-fA-F]{40}$/i.test(pasted) || /^[0-9a-fA-F]{40}$/i.test(pasted)) {
              const cleaned = pasted.startsWith("0x") ? pasted : "0x" + pasted
              onChange(cleaned)
            }
          }}
          className="flex-1 font-mono"
        />
      )
    }

    return (
      <Input
        id={fieldName}
        type="text"
        placeholder={
          fieldType.startsWith("uint") || fieldType.startsWith("int")
            ? `Number (${fieldType})`
            : ""
        }
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
    )
  }

  // Get placeholder for tuple types
  const getTuplePlaceholder = () => {
    if (isTuple) {
      return "Recommended to use the helper →"
    }
    return undefined
  }

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label htmlFor={fieldName} className="text-sm">
        {fieldName} ({fieldType})
      </Label>
      <div className="flex gap-1">
        {isTuple ? (
          <Textarea
            id={fieldName}
            placeholder={getTuplePlaceholder()}
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 font-mono text-sm"
            rows={3}
          />
        ) : (
          renderInput()
        )}
        {(needsValueParserHelper || needsTupleHelper || needsListHelper) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 flex items-center justify-center"
                onClick={() => {
                  if (needsValueParserHelper && onValueHelper) {
                    onValueHelper(fieldName)
                  } else if (needsTupleHelper && onTupleHelper) {
                    onTupleHelper(fieldName, abiParam)
                  } else if (needsListHelper && onListHelper) {
                    onListHelper(fieldName, abiParam)
                  }
                }}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {needsValueParserHelper ? "Value Helper" : needsTupleHelper ? "Tuple Helper" : "List Helper"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

