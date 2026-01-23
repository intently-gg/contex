import { useState, useEffect, useMemo, useCallback } from "react"
import { useChainId } from "wagmi"
import { encodeFunctionData } from "viem"
import { useWriteContractFunction } from "@/hooks/useContractFunctions"
import { generateFormFields, parseInputValue, needsValueParser, isTupleType, getBaseType } from "@/lib/formGenerator"
import { useContractStore } from "@/stores/contractStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResultRenderer } from "@/components/shared/ResultRenderer"
import { Pin, PinOff, RotateCcw, Sparkles, Pencil, Braces, Import } from "lucide-react"
import { InputControl } from "@/components/shared/InputControl"
import { ResultPane } from "@/components/shared/ResultPane"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import { BytesHelperModal } from "./BytesHelperModal"
import { EncodeDestinationModal } from "./EncodeDestinationModal"
import { ImportCalldataModal } from "./ImportCalldataModal"
import { copyToClipboard, sanitizeForSerialization, getFunctionSignature } from "@/lib/utils"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"
import { toast } from "sonner"

interface WriteFunctionProps {
  abiKey: string
  address: Address
  abi: Abi
  function: ParsedFunction
  supportedChainIds: number[]
}

export function WriteFunction({
  abiKey,
  address,
  abi,
  function: func,
  supportedChainIds,
}: WriteFunctionProps) {
  const chainId = useChainId()
  const { getFormState, setFormState, isFavorite, toggleFavorite } =
    useContractStore()

  const formFields = generateFormFields([...func.inputs])
  const savedFormState = getFormState(abiKey, func.functionId) || {}
  const [inputs, setInputs] = useState<Record<string, unknown>>(
    savedFormState
  )
  const [value, setValue] = useState<string>("")
  const [valueParserOpen, setValueParserOpen] = useState<string | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [listHelperOpen, setListHelperOpen] = useState<{ fieldName: string; abiParam: any } | null>(null)
  const [bytesHelperOpen, setBytesHelperOpen] = useState<{ fieldName: string; abiParam: any; currentValue?: string } | null>(null)
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [encodeError, setEncodeError] = useState<Error | null>(null)
  const [encodeSuccess, setEncodeSuccess] = useState(false)
  const [encodeDestinationOpen, setEncodeDestinationOpen] = useState(false)
  const [encodedDataForDestination, setEncodedDataForDestination] = useState<string | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const { write, hash, error, isPending, isConfirming, isConfirmed, isReverted } =
    useWriteContractFunction(address, abi, func.name)

  useEffect(() => {
    setFormState(abiKey, func.functionId, inputs)
  }, [inputs, abiKey, func.functionId, setFormState])

  const isFav = isFavorite(abiKey, func.functionId)
  const isPayable = func.stateMutability === "payable"

  // Check if any data has been entered
  const hasData = useMemo(() => {
    return (
      Object.values(inputs).some((v) => v !== undefined && v !== "" && String(v).trim() !== "") ||
      (isPayable && value && value.trim() !== "")
    )
  }, [inputs, value, isPayable])

  const buildArgsAndValue = () => {
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
      if (field.type.includes("[]") && isTupleType(getBaseType(field.type))) {
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

    return { filteredArgs, valueBigInt }
  }

  const handleWrite = async () => {
    const { filteredArgs, valueBigInt } = buildArgsAndValue()

    try {
      await write(filteredArgs, valueBigInt)
    } catch (err) {
      console.error("Write error:", err)
    }
  }

  // Synchronous encoding function for clipboard
  const handleEncodeToClipboardSync = (): string | null => {
    try {
      const { filteredArgs } = buildArgsAndValue()
      const data = encodeFunctionData({
        abi,
        functionName: func.name,
        args: filteredArgs,
      })
      return data
    } catch (err) {
      console.error("Encode error:", err)
      return null
    }
  }

  const handleEncodeToClipboard = async () => {
    setEncodeError(null)
    setEncodeSuccess(false)
    
    try {
      const { filteredArgs } = buildArgsAndValue()
      const data = encodeFunctionData({
        abi,
        functionName: func.name,
        args: filteredArgs,
      })

      // Try clipboard API
      let success = false
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(data)
          success = true
        } catch (err) {
          console.error("Navigator clipboard write failed:", err)
        }
      }
      
      // Fallback to copyToClipboard utility
      if (!success) {
        success = await copyToClipboard(data)
      }

      if (!success) {
        setEncodeError(new Error("Failed to copy encoded bytes to clipboard"))
        return
      }

      toast.success(`Encoded ${func.name} bytes to clipboard`)
      setEncodeSuccess(true)
    } catch (err) {
      console.error("Encode error:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setEncodeError(new Error(errorMessage))
    }
  }

  const handleEncodeToFunction = async () => {
    setEncodeError(null)
    setEncodeSuccess(false)
    try {
      const { filteredArgs } = buildArgsAndValue()
      const data = encodeFunctionData({
        abi,
        functionName: func.name,
        args: filteredArgs,
      })

      setEncodedDataForDestination(data)
      setEncodeSuccess(true)
      setEncodeDestinationOpen(true)
    } catch (err) {
      console.error("Encode error:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setEncodeError(new Error(errorMessage))
    }
  }

  const handleEncodeSuccessAck = () => {
    setEncodeSuccess(false)
  }

  const handleEncodeDestinationComplete = () => {
    toast.success(`Encoded ${func.name} bytes sent to destination`, {
      duration: 5000,
    })
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

  const handleBytesHelperApply = useCallback((fieldName: string, value: string) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
    setBytesHelperOpen(null)
  }, [])

  const handleInputChange = useCallback((fieldName: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  const handleImportCalldata = useCallback((importedInputs: Record<string, unknown>) => {
    setInputs((prev) => ({ ...prev, ...importedInputs }))
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
      <CardContent className="p-4 flex flex-col flex-1 min-h-0 h-full" style={{ marginBottom: "10px", width: "100%", minWidth: 0, overflow: "hidden" }}>
        <div className="flex flex-col min-h-0 flex-1" style={{ width: "100%", minWidth: 0 }}>
          <div className="overflow-y-auto min-h-0" style={{ width: "100%", minWidth: 0 }}>
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
                        backgroundColor: 'hsl(var(--background))',
                        color: 'hsl(var(--primary-foreground))'
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Write Function</TooltipContent>
                </Tooltip>
                <span className="text-base font-medium">{func.displayName}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      ({getFunctionSignature(func.abiFunction)})
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Function Signature</TooltipContent>
                </Tooltip>
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
                      onClick={() => toggleFavorite(abiKey, func.functionId)}
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
                      onClick={() => setShowJsonModal(true)}
                    >
                      <Braces className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Show Function JSON</TooltipContent>
                </Tooltip>
                {func.inputs.length > 0 && (
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
                        onClick={() => setImportModalOpen(true)}
                      >
                        <Import className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import Calldata Bytes</TooltipContent>
                  </Tooltip>
                )}
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
                <div className="space-y-1 pr-[5px]">
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
                      onBytesHelper={(name, param) => setBytesHelperOpen({ fieldName: name, abiParam: param, currentValue: String(inputs[name] || "") })}
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
                      onChange={(e) => {
                        const val = e.target.value
                        // Only allow digits 0-9 (same as uint256)
                        if (val === "" || /^[0-9]*$/.test(val)) {
                          setValue(val)
                        }
                      }}
                      className="flex-1"
                    />
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
                          onClick={() => setValueParserOpen("__eth_value__")}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Integer Helper</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result Pane - Pinned to bottom when content overflows */}
          <div className="flex-1 min-h-0" style={{ width: "100%", minWidth: 0, minHeight: "155px" }}>
            <ResultPane
              type="write"
              isLoading={isPending}
              error={sanitizedError}
              hash={hash}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              isReverted={isReverted}
              onExecute={handleWrite}
              disabled={!supportedChainIds.includes(chainId)}
              onEncodeToClipboard={handleEncodeToClipboard}
              onEncodeToClipboardSync={handleEncodeToClipboardSync}
              onEncodeToFunction={handleEncodeToFunction}
              encodeError={encodeError}
              encodeSuccess={encodeSuccess}
              onEncodeSuccessAck={handleEncodeSuccessAck}
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
              abiKey={abiKey}
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
          abiKey={abiKey}
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
          onBytesHelper={(name, param, currentValue) => setBytesHelperOpen({ fieldName: name, abiParam: param, currentValue })}
          abiKey={abiKey}
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
          onBytesHelper={(name, param, currentValue) => setBytesHelperOpen({ fieldName: name, abiParam: param, currentValue })}
          abiKey={abiKey}
          address={address}
          functionName={func.name}
        />
      )}
      {bytesHelperOpen && (
        <BytesHelperModal
          open={!!bytesHelperOpen}
          onOpenChange={(open) => setBytesHelperOpen(open ? bytesHelperOpen : null)}
          onApply={(value) => handleBytesHelperApply(bytesHelperOpen.fieldName, value)}
          fieldName={bytesHelperOpen.fieldName}
          abiParam={bytesHelperOpen.abiParam}
          currentValue={bytesHelperOpen.currentValue !== undefined ? bytesHelperOpen.currentValue : String(inputs[bytesHelperOpen.fieldName] || "")}
          onValueHelper={(name) => setValueParserOpen(name)}
          onTupleHelper={(name, param) => setTupleHelperOpen({ fieldName: name, abiParam: param })}
          onListHelper={(name, param) => setListHelperOpen({ fieldName: name, abiParam: param })}
          onBytesHelper={(name, param, currentValue) => setBytesHelperOpen({ fieldName: name, abiParam: param, currentValue })}
          abiKey={abiKey}
          address={address}
          functionName={func.name}
        />
      )}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Function JSON: {func.displayName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            <ResultRenderer value={func.abiFunction} className="h-full" defaultFormat="json" />
          </div>
        </DialogContent>
      </Dialog>
      <EncodeDestinationModal
        open={encodeDestinationOpen}
        onOpenChange={setEncodeDestinationOpen}
        encodedData={encodedDataForDestination}
        sourceAbiKey={abiKey}
        sourceFunctionId={func.functionId}
        sourceFunctionName={func.name}
        onComplete={handleEncodeDestinationComplete}
      />
      {func.inputs.length > 0 && (
        <ImportCalldataModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          onImport={handleImportCalldata}
          abi={abi}
          functionName={func.name}
        />
      )}
    </Card>
  )
}
