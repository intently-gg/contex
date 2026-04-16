import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sparkles, ScanEye, Binary } from "lucide-react"
import { needsValueParser, isTupleType, isListType, generateFormFields } from "@/lib/formGenerator"
import { extractFunctionSelector, findFunctionBySignature, safeStringify } from "@/lib/utils"
import { findRegisteredAddressForInput } from "@/lib/config"
import { useABIStore } from "@/stores/abiStore"
import { useThemeStore } from "@/stores/themeStore"
import { decodeFunctionData } from "viem"
import { useChainId } from "wagmi"
import { stringify as yamlStringify } from "yaml"
import Editor from "@monaco-editor/react"
import { toast } from "sonner"
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
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter) => void
  onAddressHelper?: (fieldName: string, abiParam: AbiParameter) => void
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
  onBytesHelper,
  onAddressHelper,
  className,
}: InputControlProps) {
  const chainId = useChainId()
  const { abis } = useABIStore()
  const { theme } = useThemeStore()
  const [autoDecodeBytes, setAutoDecodeBytes] = useState(true)
  const isArray = isListType(fieldType)
  const isTuple = isTupleType(fieldType)
  const needsValueParserHelper = needsValueParser(fieldName, fieldType)
  const needsTupleHelper = isTuple && onTupleHelper
  const needsListHelper = isArray && onListHelper
  const needsAddressHelper = (fieldType === "address" || fieldType === "bytes32") && !!onAddressHelper

  const matchedRegisteredAddress = useMemo(() => {
    if (fieldType !== "address" && fieldType !== "bytes32") return undefined
    return findRegisteredAddressForInput(value, fieldType, chainId)
  }, [value, fieldType, chainId])

  /** Used to measure value width with the same font as the visible input (avoids broken layout from abs. spans inside min-w-0). */
  const registryHintInputRef = useRef<HTMLInputElement>(null)
  const [registryLabelLeftPx, setRegistryLabelLeftPx] = useState(0)

  useLayoutEffect(() => {
    if (!matchedRegisteredAddress) {
      setRegistryLabelLeftPx(0)
      return
    }
    const input = registryHintInputRef.current
    if (!input) {
      setRegistryLabelLeftPx(0)
      return
    }
    const cs = window.getComputedStyle(input)
    const padL = parseFloat(cs.paddingLeft) || 0
    const text = String(value ?? "")
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setRegistryLabelLeftPx(0)
      return
    }
    ctx.font = cs.font
    const textW = ctx.measureText(text).width
    setRegistryLabelLeftPx(Math.ceil(padL + textW + 6))
  }, [value, matchedRegisteredAddress])
  
  // Check if bytes field matches a function signature
  const matchedFunction = useMemo(() => {
    if (fieldType !== "bytes" || !onBytesHelper) return null
    const selector = extractFunctionSelector(value)
    if (!selector) return null
    return findFunctionBySignature(selector, abis)
  }, [fieldType, value, abis, onBytesHelper])
  
  const needsBytesHelper = matchedFunction !== null && onBytesHelper
  const showDecodedView = needsBytesHelper && autoDecodeBytes && matchedFunction && typeof value === "string" && value.length > 0

  const hasAnyHelper =
    needsValueParserHelper ||
    needsTupleHelper ||
    needsListHelper ||
    needsBytesHelper ||
    needsAddressHelper

  const recursivelyDecodeBytes = (val: unknown): unknown => {
    if (val === null || val === undefined) {
      return val
    }
    
    if (typeof val === "string") {
      if (val.startsWith("0x") && val.length >= 10) {
        const selector = extractFunctionSelector(val)
        if (!selector) return val
        
        const match = findFunctionBySignature(selector, abis)
        if (!match) return val
        
        try {
          const decoded = decodeFunctionData({
            abi: match.abi,
            data: val as `0x${string}`,
          })
          
          const formFields = generateFormFields([...match.func.inputs])
          const decodedParams: Record<string, unknown> = {}
          
          formFields.forEach((field, index) => {
            if (decoded.args && decoded.args[index] !== undefined) {
              decodedParams[field.name] = recursivelyDecodeBytes(decoded.args[index])
            }
          })
          
          return {
            [match.func.name]: decodedParams
          }
        } catch {
          return val
        }
      }
      return val
    }
    
    if (Array.isArray(val)) {
      return val.map(item => recursivelyDecodeBytes(item))
    }
    
    if (typeof val === "bigint") {
      return val.toString()
    }
    
    if (typeof val === "object") {
      const result: Record<string, unknown> = {}
      for (const [key, v] of Object.entries(val)) {
        result[key] = recursivelyDecodeBytes(v)
      }
      return result
    }
    
    return val
  }

  const decodeBytesField = (bytesValue: string): { decoded: unknown; success: boolean } => {
    if (!matchedFunction) return { decoded: bytesValue, success: false }
    
    try {
      const decoded = decodeFunctionData({
        abi: matchedFunction.abi,
        data: bytesValue as `0x${string}`,
      })
      
      const formFields = generateFormFields([...matchedFunction.func.inputs])
      const decodedParams: Record<string, unknown> = {}
      
      formFields.forEach((field, index) => {
        if (decoded.args && decoded.args[index] !== undefined) {
          decodedParams[field.name] = recursivelyDecodeBytes(decoded.args[index])
        }
      })
      
      return { decoded: decodedParams, success: true }
    } catch {
      return { decoded: bytesValue, success: false }
    }
  }

  const canDecodeBytes = useMemo(() => {
    if (!needsBytesHelper || !matchedFunction || typeof value !== "string" || value.length === 0) {
      return true
    }
    const result = decodeBytesField(value)
    return result.success
  }, [needsBytesHelper, matchedFunction, value])

  const decodedYaml = useMemo(() => {
    if (!showDecodedView || typeof value !== "string") return ""
    try {
      const result = decodeBytesField(value)
      return yamlStringify(result.decoded, { indent: 2 })
    } catch {
      return ""
    }
  }, [showDecodedView, value, matchedFunction, abis])

  useEffect(() => {
    if (needsBytesHelper && matchedFunction && typeof value === "string" && value.length > 0) {
      if (!canDecodeBytes && autoDecodeBytes) {
        setAutoDecodeBytes(false)
      }
    }
  }, [needsBytesHelper, matchedFunction, value, canDecodeBytes, autoDecodeBytes])

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
            className="flex-1 font-mono text-sm max-h-[150px]"
            style={{ minHeight: '40px' }}
          />
        )
      }
      // Fixed-size bytes (bytes32, bytes16, etc.) - use single-line Input
      return (
        <Input
          ref={fieldType === "bytes32" ? registryHintInputRef : undefined}
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
      if (showDecodedView) {
        const lineCount = decodedYaml.split('\n').length
        const lineHeight = 18
        const calculatedHeight = Math.max(80, Math.min(150, lineCount * lineHeight + 10))
        return (
          <div className="flex-1 border rounded-md overflow-hidden" style={{ maxHeight: "150px", minHeight: "80px" }}>
            <Editor
              height={`${calculatedHeight}px`}
              language="yaml"
              theme={theme === "dark" ? "vs-dark" : "light"}
              value={decodedYaml}
              options={{
                readOnly: true,
                wordWrap: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: "off",
                folding: false,
                automaticLayout: true,
                scrollbar: {
                  vertical: "auto",
                  horizontal: "auto",
                },
              }}
            />
          </div>
        )
      }
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
          className="flex-1 font-mono max-h-[150px]"
          style={{ minHeight: '40px' }}
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
          className="flex-1 max-h-[150px]"
          style={{ minHeight: '40px' }}
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
          className="flex-1 font-mono text-sm max-h-[150px]"
          style={{ minHeight: '40px' }}
        />
      )
    }

    if (fieldType === "address") {
      return (
        <Input
          ref={registryHintInputRef}
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

  // Serialize tuple value for display
  const getTupleDisplayValue = (): string => {
    if (value === null || value === undefined || value === "") {
      return ""
    }
    // If it's already a string, use it as-is
    if (typeof value === "string") {
      return value
    }
    // If it's an array or object, serialize it
    if (Array.isArray(value) || typeof value === "object") {
      return safeStringify(value)
    }
    // For other types, convert to string
    return String(value)
  }

  // Get tuple info for display
  const getTupleInfo = (): { internalType: string | null; components: string | null } | null => {
    const isTupleType = fieldType === "tuple" || fieldType === "tuple[]" || fieldType.startsWith("tuple[")
    if (!isTupleType) return null
    
    const hasInternalType = abiParam.internalType && typeof abiParam.internalType === "string"
    const components = (abiParam as any).components as readonly AbiParameter[] | undefined
    const hasComponents = components && Array.isArray(components) && components.length > 0
    
    if (!hasInternalType && !hasComponents) return null
    
    let internalType: string | null = null
    if (hasInternalType && abiParam.internalType) {
      internalType = abiParam.internalType.replace(/^struct\s+/i, "")
    }
    
    let componentsStr: string | null = null
    if (hasComponents && components) {
      const componentStr = components
        .map((comp: AbiParameter) => `${comp.name || "unnamed"}: ${comp.type}`)
        .join(", ")
      componentsStr = `(${componentStr})`
    }
    
    return { internalType, components: componentsStr }
  }

  const tupleInfo = getTupleInfo()

  return (
    <div className={`space-y-1 ${className || ""}`}>
      <Label htmlFor={fieldName} className="text-sm">
        {fieldName} <span style={{ color: 'hsl(var(--muted-foreground))' }}>({fieldType})</span>
      </Label>
      {tupleInfo && (
        <div className="space-y-0.5">
          {tupleInfo.internalType && (
            <div 
              className="text-xs truncate"
              style={{ 
                color: '#60a5fa',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={tupleInfo.internalType}
            >
              {tupleInfo.internalType}
            </div>
          )}
          {tupleInfo.components && (
            <div 
              className="text-xs truncate"
              style={{ 
                color: '#7c8fa8',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={tupleInfo.components}
            >
              {tupleInfo.components}
            </div>
          )}
        </div>
      )}
      {needsBytesHelper && matchedFunction && (
        <div className="flex items-center gap-1" style={{ color: '#22c55e', fontSize: '0.875rem' }}>
          <ScanEye className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
          <span style={{ color: '#22c55e' }}>Encoded Function: {matchedFunction.func.name}</span>
        </div>
      )}
      <div className="flex gap-0.5 items-start">
        <div className="flex flex-col gap-0.5 shrink-0 w-10">
          {hasAnyHelper ? (
            <>
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
                      if (needsAddressHelper && onAddressHelper) {
                        onAddressHelper(fieldName, abiParam)
                      } else if (needsBytesHelper && onBytesHelper) {
                        onBytesHelper(fieldName, abiParam)
                      } else if (needsValueParserHelper && onValueHelper) {
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
                  {needsAddressHelper ? "Address Helper" : needsBytesHelper ? "Bytes Helper" : needsValueParserHelper ? "Integer Helper" : needsTupleHelper ? "Tuple Helper" : "List Helper"}
                </TooltipContent>
              </Tooltip>
              {needsBytesHelper && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={autoDecodeBytes ? "default" : "outline"}
                      size="icon"
                      className="h-10 w-10 flex items-center justify-center"
                      onClick={() => {
                        if (!autoDecodeBytes && !canDecodeBytes && matchedFunction) {
                          toast.error(
                            `Could not decode.\n\nThe bytes appear to be for function ${matchedFunction.func.name}, but cannot be successfully decoded.\n\n\nPlease confirm accuracy of input data.`
                          )
                          return
                        }
                        setAutoDecodeBytes(!autoDecodeBytes)
                      }}
                    >
                      <Binary className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {autoDecodeBytes ? "Disable auto-decode" : "Enable auto-decode"}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <div className="h-10 w-10 shrink-0" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isTuple ? (
            <Textarea
              id={fieldName}
              placeholder={getTuplePlaceholder()}
              value={getTupleDisplayValue()}
              onChange={(e) => {
                const val = e.target.value
                // Allow tuple characters: [ ] " , space and data type specific chars
                if (val === "" || /^[\s\[\]\"\,\{\}0-9a-fA-Fx\-\.]*$/.test(val)) {
                  onChange(val)
                }
              }}
              className="w-full font-mono text-sm max-h-[150px]"
              style={{ minHeight: '40px' }}
            />
          ) : fieldType === "address" || fieldType === "bytes32" ? (
            <div className="relative min-w-0">
              {renderInput()}
              {matchedRegisteredAddress ? (
                <span
                  className="pointer-events-none absolute top-1/2 z-10 max-w-[min(12rem,calc(100%-1.5rem))] -translate-y-1/2 truncate text-xs text-zinc-400 dark:text-zinc-500"
                  style={{ left: registryLabelLeftPx }}
                  title={`${matchedRegisteredAddress.type}: ${matchedRegisteredAddress.label}`}
                >
                  ({matchedRegisteredAddress.type}: {matchedRegisteredAddress.label})
                </span>
              ) : null}
            </div>
          ) : (
            renderInput()
          )}
        </div>
      </div>
    </div>
  )
}


