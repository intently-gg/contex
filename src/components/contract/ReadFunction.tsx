import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useChainId } from "wagmi"
import { useReadContractFunction } from "@/hooks/useContractFunctions"
import { generateFormFields, parseInputValue } from "@/lib/formGenerator"
import { useContractStore } from "@/stores/contractStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pin, PinOff, Eye } from "lucide-react"
import { toast } from "sonner"
import { InputControl } from "@/components/shared/InputControl"
import { ResultPane } from "@/components/shared/ResultPane"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import { sanitizeForSerialization } from "@/lib/utils"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"
import { needsValueParser } from "@/lib/formGenerator"

interface ReadFunctionProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiKey: string
  function: ParsedFunction
  supportedChainIds: number[]
  refreshKey?: number
}

export function ReadFunction({
  contractLabel,
  address,
  abi,
  abiKey,
  function: func,
  supportedChainIds: _supportedChainIds,
  refreshKey,
}: ReadFunctionProps) {
  const { getFormState, setFormState, isFavorite, toggleFavorite } =
    useContractStore()
  const [valueParserOpen, setValueParserOpen] = useState<string | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [listHelperOpen, setListHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [showCheckmark, setShowCheckmark] = useState(false)

  const formFields = generateFormFields([...func.inputs])
  const savedFormState = getFormState(abiKey, func.name) || {}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, hasNoParams])

  // Load cached result - but only if we have no fresh data
  // For functions with params, never show cached data unless manually refreshed
  const { getReadResult } = useContractStore()
  const chainId = useChainId()
  const cachedResult = getReadResult(contractLabel, chainId, func.name, address)
  
  // Use fresh data if available, otherwise use cached (for no-param functions only)
  // When address changes, the component remounts (via key prop), so we don't need to check for address changes here
  const displayData = data !== undefined ? data : (hasNoParams && cachedResult?.value !== undefined ? cachedResult.value : undefined)

  useEffect(() => {
    setFormState(abiKey, func.name, inputs)
  }, [inputs, abiFileName, func.name, setFormState])

  const wasLoadingRef = useRef(false)

  const handleRefresh = async () => {
    await refetch()
    setShowCheckmark(true)
    setTimeout(() => setShowCheckmark(false), 2000)
  }

  // Show checkmark when loading completes (for auto-refresh)
  useEffect(() => {
    if (!isLoading && wasLoadingRef.current) {
      // Just finished loading, show checkmark
      setShowCheckmark(true)
      const timer = setTimeout(() => setShowCheckmark(false), 2000)
      wasLoadingRef.current = false
      return () => clearTimeout(timer)
    }
    if (isLoading) {
      wasLoadingRef.current = true
    }
  }, [isLoading])

  const isFav = isFavorite(contractLabel, func.name)

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

  // Sanitize error and result for React DevTools (convert BigInt to string)
  const sanitizedError = useMemo(() => {
    if (!error) return null
    const sanitized = sanitizeForSerialization(error)
    if (sanitized && typeof sanitized === "object" && "message" in sanitized) {
      const err = new Error(String(sanitized.message))
      if ("name" in sanitized) err.name = String(sanitized.name)
      if ("stack" in sanitized) err.stack = String(sanitized.stack)
      Object.assign(err, sanitized)
      return err
    }
    return error
  }, [error])

  const sanitizedResult = useMemo(() => {
    if (displayData === undefined) return undefined
    return sanitizeForSerialization(displayData)
  }, [displayData])

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex flex-col max-h-[calc(100vh-200px)]" style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
        <div className="flex flex-col min-h-0" style={{ width: "100%", minWidth: 0 }}>
          <div className="flex-1 overflow-y-auto min-h-0" style={{ width: "100%", minWidth: 0 }}>
            <div className="space-y-4" style={{ width: "100%", minWidth: 0 }}>
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{
                  backgroundColor: 'hsl(var(--muted) / 0.5)',
                  borderColor: 'hsl(var(--border) / 0.5)'
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="flex items-center justify-center w-7 h-7 rounded-full"
                      style={{
                        backgroundColor: 'hsl(var(--primary) / 0.2)',
                        color: 'hsl(var(--primary-foreground))'
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Read-Only Function</TooltipContent>
                </Tooltip>
                <span className="text-base font-medium">{func.name}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 transition-colors"
                      style={{
                        borderColor: 'hsl(var(--border))'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--muted) / 0.6)'
                        e.currentTarget.style.borderColor = 'hsl(var(--accent) / 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                        e.currentTarget.style.borderColor = 'hsl(var(--border))'
                      }}
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
              </div>

              {/* Input Fields */}
              {formFields.length > 0 && (
                <div className="space-y-1">
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
            </div>
          </div>

          {/* Result Pane - Pinned to bottom when content overflows */}
          <div className="flex-shrink-0" style={{ width: "100%", minWidth: 0 }}>
            <ResultPane
              type="read"
              isLoading={isLoading}
              error={sanitizedError}
              result={sanitizedResult}
              onRefresh={handleRefresh}
              showCheckmark={showCheckmark}
            />
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

