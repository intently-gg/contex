import { useState, useEffect, useMemo, useCallback } from "react"
import { useChainId } from "wagmi"
import { useWriteContractFunction } from "@/hooks/useContractFunctions"
import { generateFormFields, parseInputValue, needsValueParser, isTupleType } from "@/lib/formGenerator"
import { useContractStore } from "@/stores/contractStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pin, PinOff, RotateCcw, Sparkles, Pencil } from "lucide-react"
import { InputControl } from "@/components/shared/InputControl"
import { ResultPane } from "@/components/shared/ResultPane"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import { sanitizeForSerialization } from "@/lib/utils"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"

interface WriteFunctionProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiKey: string
  function: ParsedFunction
  supportedChainIds: number[]
}

export function WriteFunction({
  contractLabel,
  address,
  abi,
  abiKey,
  function: func,
  supportedChainIds,
}: WriteFunctionProps) {
  const chainId = useChainId()
  const { getFormState, setFormState, isFavorite, toggleFavorite } =
    useContractStore()

  const formFields = generateFormFields([...func.inputs])
  const savedFormState = getFormState(abiKey, func.name) || {}
  const [inputs, setInputs] = useState<Record<string, unknown>>(
    savedFormState
  )
  const [value, setValue] = useState<string>("")
  const [valueParserOpen, setValueParserOpen] = useState<string | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [listHelperOpen, setListHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)

  const { write, hash, error, isPending, isConfirming, isConfirmed } =
    useWriteContractFunction(address, abi, func.name)

  useEffect(() => {
    setFormState(abiKey, func.name, inputs)
  }, [inputs, abiFileName, func.name, setFormState])

  const isFav = isFavorite(contractLabel, func.name)
  const isPayable = func.stateMutability === "payable"

  // Check if any data has been entered
  const hasData = useMemo(() => {
    return (
      Object.values(inputs).some((v) => v !== undefined && v !== "" && String(v).trim() !== "") ||
      (isPayable && value && value.trim() !== "")
    )
  }, [inputs, value, isPayable])

  const handleWrite = async () => {
    const args = formFields.map((field) => {
      const val = inputs[field.name]
      if (val === undefined || val === "") {
        return undefined
      }
      
      // Special handling for tuples - parse array elements according to component types
      if (isTupleType(field.type) && !field.type.includes("[]")) {
        const components = (field.abiParam as any).components || []
        try {
          const parsed = JSON.parse(String(val))
          // If it's an array, parse each element according to its component type
          if (Array.isArray(parsed)) {
            return parsed.map((item, index) => {
              const component = components[index]
              if (component) {
                return parseInputValue(String(item), component.type)
              }
              return item
            })
          }
          // If it's an object, return as-is (shouldn't happen with direct input, but handle it)
          return parsed
        } catch {
          // If parsing fails, try regular parsing
          return parseInputValue(String(val), field.type)
        }
      }
      
      // Special handling for tuple arrays - parse each tuple element according to component types
      if (isTupleType(field.type) && field.type.includes("[]")) {
        const components = (field.abiParam as any).components || []
        try {
          const parsed = JSON.parse(String(val))
          if (Array.isArray(parsed)) {
            return parsed.map((tupleItem) => {
              // Each tupleItem should be an array representing the tuple
              if (Array.isArray(tupleItem)) {
                return tupleItem.map((item, index) => {
                  const component = components[index]
                  if (component) {
                    return parseInputValue(String(item), component.type)
                  }
                  return item
                })
              }
              // If it's an object, convert to array format
              if (typeof tupleItem === "object" && tupleItem !== null) {
                return components.map((comp: any) => {
                  const name = comp.name || ""
                  const value = (tupleItem as any)[name] ?? ""
                  return parseInputValue(String(value), comp.type)
                })
              }
              return tupleItem
            })
          }
        } catch {
          // If parsing fails, try regular parsing
          return parseInputValue(String(val), field.type)
        }
      }
      
      // parseInputValue now handles arrays recursively, converting string numbers to proper types
      return parseInputValue(String(val), field.type)
    })

    const filteredArgs = args.filter((a) => a !== undefined) as unknown[]
    const valueBigInt = value ? BigInt(value) : undefined

    console.log(filteredArgs)

    try {
      await write(filteredArgs, valueBigInt)
    } catch (err) {
      console.error("Write error:", err)
    }
  }

  const handleReset = () => {
    setInputs({})
    setValue("")
  }

  const handleValueParserApply = useCallback((fieldName: string, parsedValue: string) => {
    // Special case for ETH value field
    if (fieldName === "__eth_value__") {
      setValue(parsedValue)
    } else {
      setInputs((prev) => ({ ...prev, [fieldName]: parsedValue }))
    }
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

  // Sanitize error for React DevTools (convert BigInt to string)
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
                      <Pencil className="h-3.5 w-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Write Function</TooltipContent>
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
                {hasData && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleReset}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset all inputs</TooltipContent>
                  </Tooltip>
                )}
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

              {isPayable && (
                <div className="space-y-1">
                  <Label htmlFor={`${func.name}-value`} className="text-sm">Value (wei)</Label>
                  <div className="flex gap-0.5">
                    <Input
                      id={`${func.name}-value`}
                      type="text"
                      placeholder="0"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="flex-1"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 flex items-center justify-center"
                          onClick={() => setValueParserOpen("__eth_value__")}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Value Helper</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result Pane - Pinned to bottom when content overflows */}
          <div className="flex-shrink-0" style={{ width: "100%", minWidth: 0 }}>
            <ResultPane
              type="write"
              isLoading={isPending}
              error={sanitizedError}
              hash={hash}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              onExecute={handleWrite}
              disabled={!supportedChainIds.includes(chainId)}
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
      {/* Separate ValueParserModal for ETH value field */}
      {isPayable && (
        <ValueParserModal
          key="__eth_value__"
          open={valueParserOpen === "__eth_value__"}
          onOpenChange={(open) => setValueParserOpen(open ? "__eth_value__" : null)}
          onApply={(parsedValue) => handleValueParserApply("__eth_value__", parsedValue)}
          fieldName="Value (wei)"
          fieldType="uint256"
          currentValue={value}
          contractLabel={contractLabel}
          address={address}
          functionName={func.name}
        />
      )}
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
