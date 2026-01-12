import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
      // Convert value to string for RadioGroup, use empty string for undefined/null
      const radioValue = value === true ? "true" : value === false ? "false" : ""
      
      return (
        <div className="flex items-center space-x-2 flex-1">
          <RadioGroup
            value={radioValue}
            onValueChange={(val) => {
              // If clicking the same value, deselect it (set to undefined)
              if (val === radioValue) {
                onChange(undefined)
              } else {
                onChange(val === "true")
              }
            }}
            className="flex flex-row gap-2"
          >
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="true" id={`${fieldName}-true`} />
              <Label htmlFor={`${fieldName}-true`} className="text-sm cursor-pointer">
                True
              </Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="false" id={`${fieldName}-false`} />
              <Label htmlFor={`${fieldName}-false`} className="text-sm cursor-pointer">
                False
              </Label>
            </div>
          </RadioGroup>
        </div>
      )
    }

    const isBytes = fieldType.includes("bytes")
    
    if (isBytes && fieldType !== "bytes") {
      // Check if it's an array
      if (fieldType.includes("[]")) {
        const baseType = fieldType.replace("[]", "")
        let placeholder = `Array of bytes, e.g. ["0x123...", "0xABC..."]`
        if (baseType.startsWith("tuple")) {
          placeholder = "Recommended to use the helper ➔"
        }
        return (
          <Textarea
            id={fieldName}
            placeholder={placeholder}
            value={String(value || "")}
            onChange={(e) => {
              const val = e.target.value
              // Allow array characters: [ ] " , space and hex chars
              if (val === "" || /^[\s\[\]\"\,0-9a-fA-Fx]*$/.test(val)) {
                onChange(val)
              }
            }}
            className="flex-1 font-mono text-sm"
            rows={3}
          />
        )
      }
      // Fixed-size bytes (bytes32, bytes16, etc.) - use single-line Input
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
        placeholder = "Recommended to use the helper ➔"
      }
      
      return (
        <Textarea
          id={fieldName}
          placeholder={placeholder}
          value={String(value || "")}
          onChange={(e) => {
            const val = e.target.value
            // Allow array characters: [ ] " , space and data type specific chars
            if (val === "" || /^[\s\[\]\"\,0-9a-fA-Fx\-\.]*$/.test(val)) {
              onChange(val)
            }
          }}
          className="flex-1 font-mono text-sm"
          rows={5}
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

    const isUint = fieldType.startsWith("uint")
    const isInt = fieldType.startsWith("int")
    
    return (
      <Input
        id={fieldName}
        type="text"
        placeholder={
          isUint || isInt
            ? `12345... `
            : ""
        }
        value={String(value || "")}
        onChange={(e) => {
          const val = e.target.value
          if (isUint) {
            // Only allow digits 0-9
            if (val === "" || /^[0-9]*$/.test(val)) {
              onChange(val)
            }
          } else if (isInt) {
            // Allow digits 0-9 and negative symbol
            if (val === "" || /^-?[0-9]*$/.test(val)) {
              onChange(val)
            }
          } else {
            onChange(val)
          }
        }}
        className="flex-1"
      />
    )
  }

  // Get placeholder for tuple types
  const getTuplePlaceholder = () => {
    if (isTuple) {
      return "Recommended to use the helper ➔"
    }
    return undefined
  }

  return (
    <div className={`space-y-1 ${className || ""}`}>
      <Label htmlFor={fieldName} className="text-sm">
        {fieldName} <span style={{ color: 'hsl(var(--muted-foreground))' }}>({fieldType})</span>
      </Label>
      <div className="flex gap-0.5">
        {isTuple ? (
          <Textarea
            id={fieldName}
            placeholder={getTuplePlaceholder()}
            value={String(value || "")}
            onChange={(e) => {
              const val = e.target.value
              // Allow tuple characters: [ ] " , space and data type specific chars
              if (val === "" || /^[\s\[\]\"\,\{\}0-9a-fA-Fx\-\.]*$/.test(val)) {
                onChange(val)
              }
            }}
            className="flex-1 font-mono text-sm"
            rows={5}
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
                style={{
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
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

