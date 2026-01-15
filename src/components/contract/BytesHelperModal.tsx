import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InputControl } from "@/components/shared/InputControl"
import { ResultRenderer } from "@/components/shared/ResultRenderer"
import { ValueParserModal } from "./ValueParserModal"
import { TupleHelperModal } from "./TupleHelperModal"
import { ListHelperModal } from "./ListHelperModal"
import { generateFormFields, parseInputValue, needsValueParser } from "@/lib/formGenerator"
import { extractFunctionSelector, findFunctionBySignature } from "@/lib/utils"
import { useABIStore } from "@/stores/abiStore"
import { decodeFunctionData, encodeFunctionData } from "viem"
import { toast } from "sonner"
import { AlertTriangle, Braces } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AbiParameter, Abi } from "viem"

interface BytesHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  abiParam: AbiParameter
  currentValue?: string
  onValueHelper?: (fieldName: string, fieldType: string, currentValue?: string) => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  abiKey?: string
  address?: string
  functionName?: string
}

export function BytesHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  abiParam: _abiParam,
  currentValue = "",
  onValueHelper: _onValueHelper,
  onTupleHelper,
  onListHelper,
  onBytesHelper,
  abiKey,
  address,
  functionName,
}: BytesHelperModalProps) {
  const { abis } = useABIStore()
  const [inputs, setInputs] = useState<Record<string, unknown>>({})
  const [valueParserOpen, setValueParserOpen] = useState<{ fieldName: string; fieldType: string; currentValue: string } | null>(null)
  const [tupleHelperOpen, setTupleHelperOpen] = useState<{ fieldName: string; abiParam: AbiParameter; currentValue: string } | null>(null)
  const [listHelperOpen, setListHelperOpen] = useState<{ fieldName: string; abiParam: AbiParameter; currentValue: string } | null>(null)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [hasSignatureMatch, setHasSignatureMatch] = useState(false)
  const [showJsonModal, setShowJsonModal] = useState(false)
  const [matchedFunction, setMatchedFunction] = useState<{
    abiKey: string
    abiLabel: string
    func: { name: string; inputs: readonly AbiParameter[]; abiFunction: any }
    abi: Abi
  } | null>(null)

  // Find matching function and decode bytes
  useEffect(() => {
    if (open && currentValue) {
      try {
        const selector = extractFunctionSelector(currentValue)
        if (!selector) {
          setDecodeError("Could not extract function selector from bytes")
          setMatchedFunction(null)
          setInputs({})
          return
        }

        const match = findFunctionBySignature(selector, abis)
        if (!match) {
          setDecodeError("No matching function signature found in registered ABIs")
          setHasSignatureMatch(false)
          setMatchedFunction(null)
          setInputs({})
          return
        }

        setMatchedFunction(match)
        setHasSignatureMatch(true)
        setDecodeError(null)

        // Decode the function data
        try {
          const decoded = decodeFunctionData({
            abi: match.abi,
            data: currentValue as `0x${string}`,
          })

          // Map decoded args to input fields
          const formFields = generateFormFields([...match.func.inputs])
          const decodedInputs: Record<string, unknown> = {}
          
          formFields.forEach((field, index) => {
            if (decoded.args && decoded.args[index] !== undefined) {
              const value = decoded.args[index]
              // Convert BigInt to string for display
              if (typeof value === "bigint") {
                decodedInputs[field.name] = value.toString()
              } else if (Array.isArray(value)) {
                // Serialize arrays
                decodedInputs[field.name] = JSON.stringify(value)
              } else if (value !== null && typeof value === "object") {
                // Serialize objects/tuples
                decodedInputs[field.name] = JSON.stringify(value)
              } else {
                decodedInputs[field.name] = value
              }
            }
          })

          setInputs(decodedInputs)
          setDecodeError(null)
        } catch (err) {
          setDecodeError("bytes appear to be for this function, but could not be decoded successfully")
          setInputs({})
        }
      } catch (err) {
        setDecodeError(err instanceof Error ? err.message : "Failed to process bytes")
        setHasSignatureMatch(false)
        setMatchedFunction(null)
        setInputs({})
      }
    } else if (open) {
      setMatchedFunction(null)
      setHasSignatureMatch(false)
      setInputs({})
      setDecodeError(null)
    }
  }, [open, currentValue, abis])

  // Encode function data from inputs
  const encodeFunctionDataFromInputs = useCallback(() => {
    if (!matchedFunction) return null
    
    try {
      const formFields = generateFormFields([...matchedFunction.func.inputs])
      const args = formFields.map((field) => {
        const val = inputs[field.name]
        if (val === undefined || val === "") {
          return undefined
        }
        return parseInputValue(String(val), field.type)
      })

      const filteredArgs = args.filter((a) => a !== undefined) as unknown[]
      
      if (filteredArgs.length !== matchedFunction.func.inputs.length) {
        return null
      }

      const encoded = encodeFunctionData({
        abi: matchedFunction.abi,
        functionName: matchedFunction.func.name,
        args: filteredArgs,
      })

      return encoded
    } catch {
      return null
    }
  }, [inputs, matchedFunction])

  const handleInputChange = useCallback((fieldName: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  const handleValueHelper = useCallback((compName: string) => {
    const comp = matchedFunction?.func.inputs.find((c: AbiParameter) => (c.name || "") === compName)
    if (comp) {
      setValueParserOpen({
        fieldName: compName,
        fieldType: comp.type,
        currentValue: String(inputs[compName] || "")
      })
    }
  }, [matchedFunction, inputs])

  const handleValueParserApply = useCallback((value: string) => {
    if (valueParserOpen) {
      handleInputChange(valueParserOpen.fieldName, value)
      setValueParserOpen(null)
    }
  }, [valueParserOpen, handleInputChange])

  const handleTupleHelper = useCallback((compName: string, comp: AbiParameter) => {
    if (onTupleHelper) {
      setTupleHelperOpen({
        fieldName: compName,
        abiParam: comp,
        currentValue: String(inputs[compName] || "")
      })
    }
  }, [onTupleHelper, inputs])

  const handleListHelper = useCallback((compName: string, comp: AbiParameter) => {
    if (onListHelper) {
      setListHelperOpen({
        fieldName: compName,
        abiParam: comp,
        currentValue: String(inputs[compName] || "")
      })
    }
  }, [onListHelper, inputs])

  const handleBytesHelper = useCallback((compName: string, comp: AbiParameter) => {
    if (onBytesHelper) {
      onBytesHelper(compName, comp, String(inputs[compName] || ""))
    }
  }, [onBytesHelper, inputs])

  const handleTupleHelperApply = useCallback((fieldName: string, value: string) => {
    handleInputChange(fieldName, value)
    setTupleHelperOpen(null)
  }, [handleInputChange])

  const handleListHelperApply = useCallback((fieldName: string, value: string) => {
    handleInputChange(fieldName, value)
    setListHelperOpen(null)
  }, [handleInputChange])

  const handleApply = () => {
    const encoded = encodeFunctionDataFromInputs()
    if (!encoded) {
      toast.error("Cannot encode function data", {
        description: "Please ensure all required parameters are filled correctly.",
      })
      return
    }

    try {
      onApply(encoded)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to apply bytes", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const formFields = matchedFunction ? generateFormFields([...matchedFunction.func.inputs]) : []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  Bytes Helper
                  {matchedFunction && ` - Decoded ${matchedFunction.abiLabel}.${matchedFunction.func.name}`}
                </DialogTitle>
                <DialogDescription>
                  {matchedFunction 
                    ? `Decode and edit ${fieldName} function call bytes`
                    : "No matching function signature found"}
                </DialogDescription>
              </div>
              {matchedFunction && (
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
              )}
            </div>
          </DialogHeader>
          
          {decodeError && hasSignatureMatch && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm flex items-center gap-2" style={{ color: '#f59e0b' }}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
              <span style={{ color: '#f59e0b' }}>{decodeError}</span>
            </div>
          )}

          {!hasSignatureMatch && decodeError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
              {decodeError}
            </div>
          )}

          {matchedFunction && formFields.length > 0 && !decodeError ? (
            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {formFields.map((field) => (
                <InputControl
                  key={field.name}
                  fieldName={field.name}
                  fieldType={field.type}
                  abiParam={field.abiParam}
                  value={inputs[field.name] ?? ""}
                  onChange={(value) => handleInputChange(field.name, value)}
                  onValueHelper={needsValueParser(field.name, field.type) ? () => handleValueHelper(field.name) : undefined}
                  onTupleHelper={onTupleHelper ? (name, param) => handleTupleHelper(name, param) : undefined}
                  onListHelper={onListHelper ? (name, param) => handleListHelper(name, param) : undefined}
                  onBytesHelper={onBytesHelper ? (name, param) => handleBytesHelper(name, param) : undefined}
                />
              ))}
            </div>
          ) : matchedFunction && !decodeError ? (
            <div className="text-muted-foreground text-sm h-32 flex items-center justify-center border rounded-md">
              This function has no parameters
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!matchedFunction || !!decodeError}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formFields.map((field) => {
        if (needsValueParser(field.name, field.type)) {
          return (
            <ValueParserModal
              key={`value-${field.name}`}
              open={valueParserOpen?.fieldName === field.name}
              onOpenChange={(open) => setValueParserOpen(open ? { fieldName: field.name, fieldType: field.type, currentValue: String(inputs[field.name] || "") } : null)}
              onApply={handleValueParserApply}
              fieldName={field.name}
              fieldType={field.type}
              currentValue={String(inputs[field.name] || "")}
              abiKey={abiKey}
              address={address}
              functionName={functionName}
            />
          )
        }
        return null
      })}

      {tupleHelperOpen && (
        <TupleHelperModal
          open={true}
          onOpenChange={(open) => setTupleHelperOpen(open ? tupleHelperOpen : null)}
          onApply={(value) => handleTupleHelperApply(tupleHelperOpen.fieldName, value)}
          fieldName={tupleHelperOpen.fieldName}
          abiParam={tupleHelperOpen.abiParam}
          currentValue={tupleHelperOpen.currentValue}
          onTupleHelper={onTupleHelper ? (name, param, val) => {
            setTupleHelperOpen({ fieldName: name, abiParam: param, currentValue: val || "" })
          } : undefined}
          onListHelper={onListHelper ? (name, param, val) => {
            setListHelperOpen({ fieldName: name, abiParam: param, currentValue: val || "" })
          } : undefined}
          onBytesHelper={onBytesHelper ? (name, param) => handleBytesHelper(name, param) : undefined}
          abiKey={abiKey}
          address={address}
          functionName={functionName}
        />
      )}

      {listHelperOpen && (
        <ListHelperModal
          open={true}
          onOpenChange={(open) => setListHelperOpen(open ? listHelperOpen : null)}
          onApply={(value) => handleListHelperApply(listHelperOpen.fieldName, value)}
          fieldName={listHelperOpen.fieldName}
          abiParam={listHelperOpen.abiParam}
          currentValue={listHelperOpen.currentValue}
          onTupleHelper={onTupleHelper ? (name, param, val) => {
            setTupleHelperOpen({ fieldName: name, abiParam: param, currentValue: val || "" })
          } : undefined}
          onListHelper={onListHelper ? (name, param, val) => {
            setListHelperOpen({ fieldName: name, abiParam: param, currentValue: val || "" })
          } : undefined}
          onBytesHelper={onBytesHelper ? (name, param) => handleBytesHelper(name, param) : undefined}
          abiKey={abiKey}
          address={address}
          functionName={functionName}
        />
      )}
      {matchedFunction && (
        <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
          <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
              <DialogTitle>Function JSON: {matchedFunction.func.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 px-6 pb-6">
              <ResultRenderer value={matchedFunction.func.abiFunction} className="h-full" defaultFormat="json" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

