import { useState, useEffect, useMemo, useCallback } from "react"
import { useChainId } from "wagmi"
import { useWriteContractFunction } from "@/hooks/useContractFunctions"
import { generateFormFields, parseInputValue, needsValueParser } from "@/lib/formGenerator"
import { useContractStore } from "@/stores/contractStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pin, PinOff, AlertCircle, CheckCircle2, Zap, RotateCcw, Sparkles } from "lucide-react"
import { InputControl } from "@/components/shared/InputControl"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"

interface WriteFunctionProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiFileName: string
  function: ParsedFunction
  supportedChainIds: number[]
}

export function WriteFunction({
  contractLabel,
  address,
  abi,
  abiFileName,
  function: func,
  supportedChainIds,
}: WriteFunctionProps) {
  const chainId = useChainId()
  const { getFormState, setFormState, isFavorite, toggleFavorite } =
    useContractStore()

  const formFields = generateFormFields([...func.inputs])
  const savedFormState = getFormState(abiFileName, func.name) || {}
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
    setFormState(abiFileName, func.name, inputs)
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
      return parseInputValue(String(val), field.type)
    })

    const filteredArgs = args.filter((a) => a !== undefined) as unknown[]
    const valueBigInt = value ? BigInt(value) : undefined

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
    setInputs((prev) => ({ ...prev, [fieldName]: parsedValue }))
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

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-[40%_60%] gap-4">
          {/* Left Column: Function Label and Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium">{func.name}</span>
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

            {isPayable && (
              <div className="space-y-2">
                <Label htmlFor={`${func.name}-value`} className="text-sm">Value (wei)</Label>
                <div className="flex gap-1">
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
                        onClick={() => setValueParserOpen("value")}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Value Helper</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            <Button
              onClick={handleWrite}
              disabled={isPending || isConfirming || !supportedChainIds.includes(chainId)}
              style={{
                maxWidth: '100px',
                opacity: (isPending || isConfirming || !supportedChainIds.includes(chainId)) ? 0.5 : 1,
                cursor: (isPending || isConfirming || !supportedChainIds.includes(chainId)) ? 'not-allowed' : 'pointer',
              }}
              variant="default"
            >
              <Zap className={`mr-2 h-4 w-4 ${isPending || isConfirming ? "animate-pulse" : ""}`} />
              Execute
            </Button>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-2" style={{ paddingRight: '10px' }}>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-pink-600 dark:text-pink-400 break-words overflow-wrap-anywhere">
                  {error.message || "Transaction failed"}
                </AlertDescription>
              </Alert>
            )}

            {hash && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Transaction Submitted</AlertTitle>
                <AlertDescription>
                  Hash: {hash}
                  {isConfirming && " (Confirming...)"}
                  {isConfirmed && " (Confirmed!)"}
                </AlertDescription>
              </Alert>
            )}
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
