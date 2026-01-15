import { useState, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WrapText, Copy, Check, Binary } from "lucide-react"
import Editor from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { stringify as yamlStringify } from "yaml"
import { safeStringify, copyToClipboard, extractFunctionSelector, findFunctionBySignature } from "@/lib/utils"
import { useThemeStore } from "@/stores/themeStore"
import { useABIStore } from "@/stores/abiStore"
import { decodeFunctionData } from "viem"
import { generateFormFields, isTupleType, getBaseType } from "@/lib/formGenerator"
import { arrayToTuple } from "@/lib/tupleParser"
import { toast } from "sonner"
import type { AbiParameter } from "viem"

interface ResultRendererProps {
  value: unknown
  className?: string
  defaultFormat?: "yaml" | "json" | "raw"
  abiParam?: AbiParameter
}

export function ResultRenderer({ value, className, defaultFormat = "yaml", abiParam }: ResultRendererProps) {
  const { theme } = useThemeStore()
  const { abis } = useABIStore()
  const [format, setFormat] = useState<"yaml" | "json" | "raw">(defaultFormat)
  const [wordWrap, setWordWrap] = useState(false)
  const [autoDecodeBytes, setAutoDecodeBytes] = useState(true)
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const processDecodedValue = (val: unknown, abiParam: AbiParameter): unknown => {
    if (val === null || val === undefined) {
      return val
    }

    if (typeof val === "bigint") {
      return val.toString()
    }

    if (Array.isArray(val)) {
      const paramType = abiParam.type
      const components = (abiParam as any).components as readonly AbiParameter[] | undefined

      if (isTupleType(paramType) && components && components.length > 0) {
        const tupleObj = arrayToTuple(val, components)
        const result: Record<string, unknown> = {}
        components.forEach((component, index) => {
          const name = component.name || `param_${index}`
          const v = tupleObj[name]
          if (v !== undefined) {
            result[name] = processDecodedValue(v, component)
          }
        })
        return result
      }

      if (paramType.includes("[]")) {
        const baseType = getBaseType(paramType)
        if (isTupleType(baseType) && components && components.length > 0) {
          return val.map((item) => {
            if (Array.isArray(item)) {
              const tupleObj = arrayToTuple(item, components)
              const result: Record<string, unknown> = {}
              components.forEach((component, index) => {
                const name = component.name || `param_${index}`
                const v = tupleObj[name]
                if (v !== undefined) {
                  result[name] = processDecodedValue(v, component)
                }
              })
              return result
            }
            return item
          })
        }
      }

      return val
    }

    if (val !== null && typeof val === "object") {
      const result: Record<string, unknown> = {}
      for (const [key, v] of Object.entries(val)) {
        result[key] = v
      }
      return result
    }

    return val
  }

  const decodeBytesField = (bytesValue: unknown): unknown => {
    if (typeof bytesValue !== "string") return bytesValue
    
    const selector = extractFunctionSelector(bytesValue)
    if (!selector) return bytesValue
    
    const match = findFunctionBySignature(selector, abis)
    if (!match) return bytesValue
    
    try {
      const decoded = decodeFunctionData({
        abi: match.abi,
        data: bytesValue as `0x${string}`,
      })
      
      const formFields = generateFormFields([...match.func.inputs])
      const decodedParams: Record<string, unknown> = {}
      
      formFields.forEach((field, index) => {
        if (decoded.args && decoded.args[index] !== undefined) {
          const val = decoded.args[index]
          decodedParams[field.name] = processDecodedValue(val, field.abiParam)
        }
      })
      
      return {
        [match.func.name]: decodedParams
      }
    } catch {
      return bytesValue
    }
  }

  const recursivelyDecodeBytes = (val: unknown, contextAbiParam?: AbiParameter): unknown => {
    if (val === null || val === undefined) {
      return val
    }
    
    if (typeof val === "string") {
      if (val.startsWith("0x") && val.length >= 10) {
        return decodeBytesField(val)
      }
      return val
    }
    
    if (Array.isArray(val)) {
      if (contextAbiParam) {
        const processed = processDecodedValue(val, contextAbiParam)
        if (processed !== val) {
          if (typeof processed === "object" && !Array.isArray(processed)) {
            const result: Record<string, unknown> = {}
            const components = (contextAbiParam as any).components as readonly AbiParameter[] | undefined
            if (components) {
              for (const [key, v] of Object.entries(processed)) {
                const component = components.find((c, idx) => (c.name || `param_${idx}`) === key)
                if (component) {
                  result[key] = recursivelyDecodeBytes(v, component)
                } else {
                  result[key] = recursivelyDecodeBytes(v)
                }
              }
            } else {
              for (const [key, v] of Object.entries(processed)) {
                result[key] = recursivelyDecodeBytes(v)
              }
            }
            return result
          }
          if (Array.isArray(processed)) {
            const paramType = contextAbiParam.type
            if (paramType.includes("[]")) {
              const baseType = getBaseType(paramType)
              const components = (contextAbiParam as any).components as readonly AbiParameter[] | undefined
              if (isTupleType(baseType) && components) {
                return processed.map((item) => {
                  if (Array.isArray(item)) {
                    const itemParam: AbiParameter = {
                      name: "",
                      type: baseType,
                      components: components,
                    }
                    return recursivelyDecodeBytes(item, itemParam)
                  }
                  return recursivelyDecodeBytes(item)
                })
              }
            }
            return processed.map(item => recursivelyDecodeBytes(item))
          }
        }
      }
      return val.map(item => recursivelyDecodeBytes(item))
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

  const processedValue = useMemo(() => {
    if (format === "raw") return value
    if (!autoDecodeBytes) return value
    return recursivelyDecodeBytes(value, abiParam)
  }, [value, autoDecodeBytes, abis, format, abiParam])

  const formatResult = (val: unknown, fmt: "yaml" | "json" | "raw"): string => {
    if (val === null || val === undefined) {
      return "null"
    }
    
    if (fmt === "raw") {
      return safeStringify(val)
    }
    
    try {
      if (fmt === "yaml") {
        return yamlStringify(val, { indent: 2 })
      } else {
        return safeStringify(val, 2)
      }
    } catch {
      return String(val)
    }
  }

  const resultContent = formatResult(processedValue, format)

  // Editor will fill available space via flex layout

  const handleCopy = async () => {
    // Focus the editor, select all, copy, then unselect
    if (editorRef.current) {
      const editor = editorRef.current
      const model = editor.getModel()
      if (model) {
        editor.focus()
        const fullRange = model.getFullModelRange()
        editor.setSelection(fullRange)
        
        // Small delay to ensure selection is set
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Use Monaco's copy command which will copy the selected text
        const copyAction = editor.getAction("editor.action.clipboardCopyAction")
        if (copyAction) {
          await copyAction.run()
          // Clear selection after copy
          editor.setSelection({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
          })
          setCopied(true)
          setTimeout(() => setCopied(false), 1000)
          toast.success("Copied to clipboard")
          return
        }
      }
    }
    
    // Fallback to utility function if Monaco copy doesn't work
    const success = await copyToClipboard(resultContent)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      toast.success("Copied to clipboard")
    } else {
      toast.error("Failed to copy to clipboard")
    }
  }

  const editorTheme = theme === "dark" ? "vs-dark" : "light"

  return (
    <div className={`${className || ""} h-full flex flex-col min-h-0`}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as "yaml" | "json" | "raw")}
            className="flex items-center gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yaml" id="renderer-yaml" />
              <Label htmlFor="renderer-yaml" className="text-sm font-normal cursor-pointer">
                YAML
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="json" id="renderer-json" />
              <Label htmlFor="renderer-json" className="text-sm font-normal cursor-pointer">
                JSON
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="raw" id="renderer-raw" />
              <Label htmlFor="renderer-raw" className="text-sm font-normal cursor-pointer">
                RAW
              </Label>
            </div>
          </RadioGroup>
          <div style={{ width: 40 }} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoDecodeBytes ? "default" : "outline"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setAutoDecodeBytes(!autoDecodeBytes)}
              >
                <Binary className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {autoDecodeBytes ? "Disable auto-decode bytes" : "Enable auto-decode bytes"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={wordWrap ? "default" : "outline"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setWordWrap(!wordWrap)}
              >
                <WrapText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {wordWrap ? "Disable word wrap" : "Enable word wrap"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="border rounded-md overflow-hidden flex-1 min-h-0" style={{ minHeight: 0 }}>
        <Editor
          height="100%"
          language={format === "raw" ? "plaintext" : format}
          theme={editorTheme}
          value={resultContent}
          onMount={(editor) => {
            editorRef.current = editor
          }}
          options={{
            readOnly: true,
            wordWrap: wordWrap ? "on" : "off",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "off",
            folding: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}

