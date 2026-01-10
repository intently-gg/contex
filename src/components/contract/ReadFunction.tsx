import { useState, useEffect, useMemo, useCallback } from "react"
import { useChainId } from "wagmi"
import { useReadContractFunction } from "@/hooks/useContractFunctions"
import { generateFormFields, parseInputValue } from "@/lib/formGenerator"
import { useContractStore } from "@/stores/contractStore"
import { useThemeStore } from "@/stores/themeStore"
import { safeStringify, copyToClipboard } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RefreshCw, Pin, PinOff, Loader2, WrapText, Copy, Check } from "lucide-react"
import Editor from "@monaco-editor/react"
import { stringify as yamlStringify } from "yaml"
import { toast } from "sonner"
import { InputControl } from "@/components/shared/InputControl"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"
import { needsValueParser } from "@/lib/formGenerator"

interface ReadFunctionProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiFileName: string
  function: ParsedFunction
  supportedChainIds: number[]
  refreshKey?: number
}

export function ReadFunction({
  contractLabel,
  address,
  abi,
  abiFileName,
  function: func,
  supportedChainIds: _supportedChainIds,
  refreshKey,
}: ReadFunctionProps) {
  const { getFormState, setFormState, isFavorite, toggleFavorite } =
    useContractStore()
  const { theme } = useThemeStore()
  const [format, setFormat] = useState<"yaml" | "json" | "raw">("yaml")
  const [wordWrap, setWordWrap] = useState(false)
  const [valueParserOpen, setValueParserOpen] = useState<string | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [listHelperOpen, setListHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)

  const formFields = generateFormFields([...func.inputs])
  const savedFormState = getFormState(abiFileName, func.name) || {}
  const [inputs, setInputs] = useState<Record<string, unknown>>(
    savedFormState
  )

  const args = formFields.map((field) => {
    const value = inputs[field.name]
    if (value === undefined || value === "") {
      return undefined
    }
    return parseInputValue(String(value), field.type)
  })

  // NEVER auto-refresh functions with input parameters
  // Only auto-refresh functions with NO params when refreshKey is set
  const hasNoParams = func.inputs.length === 0
  // Enable query only for functions with no params when refreshKey is set (and > 0)
  // This ensures the query is ready to run when we trigger it
  const shouldAutoRefresh = hasNoParams && refreshKey !== undefined && refreshKey > 0

  const { data, isLoading, error, refetch } = useReadContractFunction(
    address,
    abi,
    func.name,
    args.filter((a) => a !== undefined) as unknown[],
    contractLabel,
    shouldAutoRefresh
  )

  // When refreshKey changes for functions with no params, trigger refetch
  // This is the ONLY way functions auto-refresh (controlled by refreshKey in ContractView)
  useEffect(() => {
    if (hasNoParams && refreshKey !== undefined && refreshKey > 0) {
      // Small delay to ensure cache is cleared first (happens synchronously in ContractView)
      const timer = setTimeout(() => {
        console.debug('[ReadFunction] Attempting to auto-refresh value', {
          contractLabel,
          functionName: func.name,
          address,
          refreshKey,
          hasNoParams,
        })
        refetch()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [refreshKey, hasNoParams, refetch, contractLabel, func.name, address])

  // Load cached result - but only if we have no fresh data
  // For functions with params, never show cached data unless manually refreshed
  const { getReadResult } = useContractStore()
  const chainId = useChainId()
  const cachedResult = getReadResult(contractLabel, chainId, func.name, address)
  
  // Use fresh data if available, otherwise use cached (for no-param functions only)
  // When address changes, the component remounts (via key prop), so we don't need to check for address changes here
  const displayData = data !== undefined ? data : (hasNoParams && cachedResult?.value !== undefined ? cachedResult.value : undefined)

  useEffect(() => {
    setFormState(abiFileName, func.name, inputs)
  }, [inputs, abiFileName, func.name, setFormState])

  const handleRefresh = async () => {
    await refetch()
  }

  const isFav = isFavorite(contractLabel, func.name)

  // Determine if result is complex (array/object)
  const isComplexValue = useMemo(() => {
    if (error || displayData === undefined) return false
    return typeof displayData === "object" && displayData !== null && !(displayData instanceof Date)
  }, [displayData, error])

  const formatResult = (value: unknown, fmt: "yaml" | "json" | "raw"): string => {
    if (value === null || value === undefined) {
      return "null"
    }
    
    if (fmt === "raw") {
      return safeStringify(value)
    }
    
    try {
      if (fmt === "yaml") {
        return yamlStringify(value, { indent: 2 })
      } else {
        return safeStringify(value, 2)
      }
    } catch {
      return String(value)
    }
  }

  const resultContent = error
    ? error.message || "Error reading contract"
    : displayData !== undefined
    ? formatResult(displayData, format)
    : null

  const isSimpleValue = !error && displayData !== undefined && !isComplexValue

  // Calculate Monaco editor height (max 15 lines, min 65px)
  const editorHeight = useMemo(() => {
    if (!resultContent || isSimpleValue) return "65px"
    const lines = resultContent.split("\n").length
    const lineHeight = 19 // Monaco default line height
    const maxLines = 15
    const calculatedHeight = Math.min(lines, maxLines) * lineHeight
    return `${Math.max(calculatedHeight, 65)}px`
  }, [resultContent, isSimpleValue])

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (resultContent) {
      const success = await copyToClipboard(resultContent)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
        toast.success("Copied to clipboard")
      } else {
        toast.error("Failed to copy to clipboard")
      }
    }
  }

  const handleValueParserApply = useCallback((fieldName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
    setValueParserOpen(null)
  }, [])

  const handleTupleHelperApply = useCallback((fieldName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
    setTupleHelperOpen(null)
  }, [])

  const handleListHelperApply = useCallback((fieldName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
    setListHelperOpen(null)
  }, [])

  const handleInputChange = useCallback((fieldName: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  const editorTheme = theme === "dark" ? "vs-dark" : "light"

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-[40%_60%] gap-4">
          {/* Left Column: Function Label and Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleFavorite(contractLabel, func.name)}
                  >
                    {isFav ? (
                      <Pin className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFav ? "Unpin from favorites" : "Pin to favorites"}
                </TooltipContent>
              </Tooltip>
              <span className="text-base font-medium">{func.name}</span>
            </div>

            {/* Input Fields */}
            {formFields.length > 0 && (
              <div className="space-y-2">
                {formFields.map((field) => (
                    <InputControl
                      key={field.name}
                      fieldName={field.name}
                      fieldType={field.type}
                      abiParam={field.abiParam}
                      value={inputs[field.name] ?? ""}
                      onChange={(value) => handleInputChange(field.name, value)}
                      onValueHelper={(name) => setValueParserOpen(name)}
                      onTupleHelper={(name, param) => setTupleHelperOpen({ fieldName: name, abiParam: param })}
                      onListHelper={(name, param) => setListHelperOpen({ fieldName: name, abiParam: param })}
                    />
                ))}
              </div>
            )}

            {/* Refresh Button */}
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                maxWidth: '100px',
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                opacity: isLoading ? 0.5 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--muted))'
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--muted) / 0.5)'
                }
              }}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-2" style={{ paddingRight: '10px' }}>
            <div className="flex items-center justify-between">
              {isComplexValue && (
                <div className="flex items-center gap-2">
                  <RadioGroup
                    value={format}
                    onValueChange={(value) => setFormat(value as "yaml" | "json" | "raw")}
                    className="flex items-center gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yaml" id={`${func.name}-yaml`} />
                      <label htmlFor={`${func.name}-yaml`} className="text-sm font-normal cursor-pointer">
                        YAML
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="json" id={`${func.name}-json`} />
                      <label htmlFor={`${func.name}-json`} className="text-sm font-normal cursor-pointer">
                        JSON
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="raw" id={`${func.name}-raw`} />
                      <label htmlFor={`${func.name}-raw`} className="text-sm font-normal cursor-pointer">
                        RAW
                      </label>
                    </div>
                  </RadioGroup>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
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
                </div>
              )}
              {resultContent && isComplexValue && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleCopy}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy to clipboard</TooltipContent>
                </Tooltip>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground h-32 items-center justify-center border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : error ? (
              <div className="rounded-md bg-destructive/10 p-3 text-sm border border-destructive/20 text-pink-600 dark:text-pink-400 break-words overflow-wrap-anywhere whitespace-pre-wrap flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                {error.message || "Error reading contract"}
              </div>
            ) : displayData !== undefined ? (
              isSimpleValue ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Value</div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted p-3 text-sm border flex-1">
                      {String(displayData)}
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
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden" style={{ minHeight: "65px", height: editorHeight === "auto" ? "auto" : editorHeight }}>
                  <Editor
                    height="100%"
                    language={format === "raw" ? "plaintext" : format}
                    theme={editorTheme}
                    value={resultContent || ""}
                    options={{
                      readOnly: true,
                      wordWrap: wordWrap ? "on" : "off",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      lineNumbers: "off",
                      folding: false,
                      automaticLayout: false,
                    }}
                  />
                </div>
              )
            ) : null}
          </div>
        </div>
      </CardContent>
      {formFields.map((field) => {
        if (needsValueParser(field.name, field.type)) {
          return (
            <ValueParserModal
              key={`value-${field.name}`}
              open={valueParserOpen === field.name}
              onOpenChange={(open) => setValueParserOpen(open ? field.name : null)}
              onApply={(value) => handleValueParserApply(field.name, value)}
              fieldName={field.name}
              fieldType={field.type}
              currentValue={String(inputs[field.name] || "")}
              contractLabel={contractLabel}
              address={address}
              functionName={func.name}
            />
          )
        }
        return null
      })}
      {tupleHelperOpen && (
        <TupleHelperModal
          open={!!tupleHelperOpen}
          onOpenChange={(open) => setTupleHelperOpen(open ? tupleHelperOpen : null)}
          onApply={(value) => handleTupleHelperApply(tupleHelperOpen.fieldName, value)}
          fieldName={tupleHelperOpen.fieldName}
          abiParam={tupleHelperOpen.abiParam}
          currentValue={String(inputs[tupleHelperOpen.fieldName] || "")}
          onValueHelper={(name) => setValueParserOpen(name)}
          onTupleHelper={(name, param) => setTupleHelperOpen({ fieldName: name, abiParam: param })}
          onListHelper={(name, param) => setListHelperOpen({ fieldName: name, abiParam: param })}
          contractLabel={contractLabel}
          address={address}
          functionName={func.name}
        />
      )}
      {listHelperOpen && (
        <ListHelperModal
          open={!!listHelperOpen}
          onOpenChange={(open) => setListHelperOpen(open ? listHelperOpen : null)}
          onApply={(value) => handleListHelperApply(listHelperOpen.fieldName, value)}
          fieldName={listHelperOpen.fieldName}
          abiParam={listHelperOpen.abiParam}
          currentValue={String(inputs[listHelperOpen.fieldName] || "")}
          onValueHelper={(name) => setValueParserOpen(name)}
          onTupleHelper={(name, param) => setTupleHelperOpen({ fieldName: name, abiParam: param })}
          onListHelper={(name, param) => setListHelperOpen({ fieldName: name, abiParam: param })}
          contractLabel={contractLabel}
          address={address}
          functionName={func.name}
        />
      )}
    </Card>
  )
}

