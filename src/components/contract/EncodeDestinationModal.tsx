import { useMemo, useState, useEffect } from "react"
import type { Abi } from "viem"
import { useChainId } from "wagmi"
import { useABIStore } from "@/stores/abiStore"
import { useContractStore } from "@/stores/contractStore"
import { parseABI, type ParsedFunction } from "@/lib/abiParser"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Clock, ArrowUpCircle, ArrowDownCircle, CirclePlus, CircleMinus, FileCode, Scroll, SquareFunction, Check, Square } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn, truncateLabel, safeStringify } from "@/lib/utils"
import { ResultRenderer } from "@/components/shared/ResultRenderer"

interface EncodeDestinationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  encodedData: string | null
  sourceAbiKey: string
  sourceFunctionId: string
  sourceFunctionName: string
  onComplete?: () => void
}

interface ByteParamTarget {
  abiKey: string
  abiLabel: string
  contractIndex: number
  contractLabel: string
  contractAddress: string
  func: ParsedFunction
  paramIndex: number
  isArray: boolean
}

export function EncodeDestinationModal({
  open,
  onOpenChange,
  encodedData,
  sourceAbiKey,
  sourceFunctionId,
  sourceFunctionName,
  onComplete,
}: EncodeDestinationModalProps) {
  const { abis } = useABIStore()
  const {
    contracts,
    setSelectedAbiKey,
    setSelectedAddress,
    setSelectedFunction,
    setFormState,
    getFormState,
    addEncodeDestination,
    getRecentEncodeDestinations,
  } = useContractStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentChainOnly, setCurrentChainOnly] = useState(true)
  const [listPromptOpen, setListPromptOpen] = useState(false)
  const [bytesPromptOpen, setBytesPromptOpen] = useState(false)
  const [listPromptTarget, setListPromptTarget] = useState<ByteParamTarget | null>(null)
  const [listPromptExisting, setListPromptExisting] = useState<string[] | null>(null)
  const [bytesPromptTarget, setBytesPromptTarget] = useState<ByteParamTarget | null>(null)
  const [bytesPromptExisting, setBytesPromptExisting] = useState<string | null>(null)
  const [clearExistingFirst, setClearExistingFirst] = useState(false)
  const [selectedInsertIndex, setSelectedInsertIndex] = useState<number | null>(null)
  const chainId = useChainId()

  // Reset state when list prompt opens
  useEffect(() => {
    if (listPromptOpen) {
      setClearExistingFirst(false)
      setSelectedInsertIndex(null)
    }
  }, [listPromptOpen])

  const isBytesType = (type: string): boolean => {
    const normalized = type.toLowerCase().trim()
    return normalized === "bytes" || normalized === "bytes[]"
  }

  const targets = useMemo<ByteParamTarget[]>(() => {
    const items: ByteParamTarget[] = []

    for (const [abiKey, entry] of Object.entries(abis)) {
      const contractEntries = contracts[abiKey]
      if (!contractEntries || contractEntries.length === 0) continue

      const eligibleAddresses = currentChainOnly
        ? contractEntries.filter((addr) => addr.chainIds.includes(chainId))
        : contractEntries

      if (eligibleAddresses.length === 0) continue

      const abi = entry.abi as Abi | undefined
      if (!abi) continue

      const parsed = parseABI(abi)
      if (!parsed) continue

      for (const func of parsed) {
        func.inputs.forEach((input, index) => {
          if (isBytesType(input.type)) {
            eligibleAddresses.forEach((contract, contractIdx) => {
              items.push({
                abiKey,
                abiLabel: entry.label,
                contractIndex: contractIdx,
                contractLabel: contract.label,
                contractAddress: contract.address,
                func,
                paramIndex: index,
                isArray: input.type.toLowerCase().includes("[]"),
              })
            })
          }
        })
      }
    }

    return items
  }, [abis, contracts, currentChainOnly, chainId])

  const recentDestinations = useMemo(() => {
    const recent = getRecentEncodeDestinations()
    return recent
      .map((recent) => {
        const target = targets.find(
          (t) =>
            t.abiKey === recent.abiKey &&
            t.func.functionId === recent.functionId &&
            t.paramIndex === recent.paramIndex
        )
        return target
      })
      .filter((t): t is ByteParamTarget => t !== undefined)
  }, [targets, getRecentEncodeDestinations])

  const filteredTargets = useMemo(() => {
    if (!searchQuery.trim()) return targets
    const q = searchQuery.toLowerCase()
    return targets.filter((t) => {
      const param = t.func.inputs[t.paramIndex]
      const abiLabel = t.abiLabel.toLowerCase()
      const funcName = t.func.name.toLowerCase()
      const displayName = t.func.displayName.toLowerCase()
      const paramName = (param.name || "").toLowerCase()
      const paramType = param.type.toLowerCase()
      const contractLabel = t.contractLabel.toLowerCase()
      const contractAddr = t.contractAddress.toLowerCase()
      return (
        abiLabel.includes(q) ||
        funcName.includes(q) ||
        displayName.includes(q) ||
        paramName.includes(q) ||
        paramType.includes(q) ||
        contractLabel.includes(q) ||
        contractAddr.includes(q)
      )
    })
  }, [targets, searchQuery])

  const filteredRecent = useMemo(() => {
    if (!searchQuery.trim()) return recentDestinations
    const q = searchQuery.toLowerCase()
    return recentDestinations.filter((t) => {
      const param = t.func.inputs[t.paramIndex]
      const abiLabel = t.abiLabel.toLowerCase()
      const funcName = t.func.name.toLowerCase()
      const displayName = t.func.displayName.toLowerCase()
      const paramName = (param.name || "").toLowerCase()
      const paramType = param.type.toLowerCase()
      const contractLabel = t.contractLabel.toLowerCase()
      const contractAddr = t.contractAddress.toLowerCase()
      return (
        abiLabel.includes(q) ||
        funcName.includes(q) ||
        displayName.includes(q) ||
        paramName.includes(q) ||
        paramType.includes(q) ||
        contractLabel.includes(q) ||
        contractAddr.includes(q)
      )
    })
  }, [recentDestinations, searchQuery])

  const handleSelectTarget = (target: ByteParamTarget) => {
    if (!encodedData) return

    const { abiKey, func, paramIndex, contractIndex } = target
    const contractEntries = contracts[abiKey]
    if (!contractEntries || contractEntries.length === 0) return

    const eligibleAddresses = currentChainOnly
      ? contractEntries.filter((addr) => addr.chainIds.includes(chainId))
      : contractEntries

    if (eligibleAddresses.length === 0) return

    const param = func.inputs[paramIndex]
    const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`

    const existingForm = getFormState(abiKey, func.functionId) || {}
    const existingValueRaw = existingForm[paramName]
    const existingValue =
      typeof existingValueRaw === "string" ? existingValueRaw.trim() : existingValueRaw === undefined ? "" : String(existingValueRaw)

    const isList = target.isArray

    const applyArrayValue = (arr: string[]) => {
      const newForm = {
        ...existingForm,
        [paramName]: safeStringify(arr),
      }

      setSelectedAbiKey(abiKey)
      setSelectedAddress(abiKey, contractIndex)
      setSelectedFunction(abiKey, func.functionId)
      setFormState(abiKey, func.functionId, newForm)
      addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
      onComplete?.()
    }

    const applyBytesValue = (value: string) => {
      const newForm = {
        ...existingForm,
        [paramName]: value,
      }

      setSelectedAbiKey(abiKey)
      setSelectedAddress(abiKey, contractIndex)
      setSelectedFunction(abiKey, func.functionId)
      setFormState(abiKey, func.functionId, newForm)
      addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
      onComplete?.()
    }

    if (isList) {
      if (!existingValue) {
        applyArrayValue([encodedData])
        onOpenChange(false)
        return
      }

      let existingArray: string[]
      try {
        const parsed = JSON.parse(existingValue)
        if (Array.isArray(parsed)) {
          existingArray = parsed.map((v) => String(v))
        } else {
          existingArray = [String(parsed)]
        }
      } catch {
        existingArray = [String(existingValue)]
      }

      setListPromptTarget(target)
      setListPromptExisting(existingArray)
      setListPromptOpen(true)
      return
    }

    if (existingValue) {
      setBytesPromptTarget(target)
      setBytesPromptExisting(existingValue)
      setBytesPromptOpen(true)
      return
    }

    applyBytesValue(encodedData)
    onOpenChange(false)
  }

  const groupedByAbi = useMemo(() => {
    const groups: Record<
      string,
      {
        abiLabel: string
        contracts: Record<
          number,
          {
            contractLabel: string
            contractAddress: string
            items: ByteParamTarget[]
          }
        >
      }
    > = {}

    for (const t of filteredTargets) {
      if (!groups[t.abiKey]) {
        groups[t.abiKey] = {
          abiLabel: t.abiLabel,
          contracts: {},
        }
      }
      if (!groups[t.abiKey].contracts[t.contractIndex]) {
        groups[t.abiKey].contracts[t.contractIndex] = {
          contractLabel: t.contractLabel,
          contractAddress: t.contractAddress,
          items: [],
        }
      }
      groups[t.abiKey].contracts[t.contractIndex].items.push(t)
    }

    return groups
  }, [filteredTargets])

  const groupedRecent = useMemo(() => {
    const groups: Record<
      string,
      {
        abiLabel: string
        contracts: Record<
          number,
          {
            contractLabel: string
            contractAddress: string
            items: ByteParamTarget[]
          }
        >
      }
    > = {}

    for (const t of filteredRecent) {
      if (!groups[t.abiKey]) {
        groups[t.abiKey] = {
          abiLabel: t.abiLabel,
          contracts: {},
        }
      }
      if (!groups[t.abiKey].contracts[t.contractIndex]) {
        groups[t.abiKey].contracts[t.contractIndex] = {
          contractLabel: t.contractLabel,
          contractAddress: t.contractAddress,
          items: [],
        }
      }
      groups[t.abiKey].contracts[t.contractIndex].items.push(t)
    }

    return groups
  }, [filteredRecent])

  const renderTree = (
    groups: typeof groupedByAbi
  ) => {
    return (
      <div className="space-y-2">
        {Object.entries(groups).map(([abiKey, group]) => {
          const truncated = truncateLabel(group.abiLabel)
          return (
            <div key={abiKey} className="space-y-0.5">
              <div className="flex items-center gap-2 px-1.5 py-1 bg-muted/50 rounded text-xs">
                <FileCode className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-semibold truncate">{truncated.display}</span>
                  </TooltipTrigger>
                  {truncated.display !== truncated.full ? (
                    <TooltipContent>
                      <p>{truncated.full}</p>
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </div>

              {Object.entries(group.contracts).map(([contractIdx, contract]) => {
                const addrAbbr = `${contract.contractAddress.slice(0, 6)}...${contract.contractAddress.slice(-4)}`
                return (
                  <div key={contractIdx} className="ml-3 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1.5 py-0.5">
                      <Scroll className="h-3 w-3 flex-shrink-0" />
                      <span>{contract.contractLabel} ({addrAbbr})</span>
                    </div>

                    {Object.values(
                      contract.items.reduce<Record<string, { func: ParsedFunction; params: ByteParamTarget[] }>>(
                        (acc, t) => {
                          if (!acc[t.func.functionId]) {
                            acc[t.func.functionId] = { func: t.func, params: [] }
                          }
                          acc[t.func.functionId].params.push(t)
                          return acc
                        },
                        {}
                      )
                    ).map(({ func, params }) => (
                      <div key={func.functionId} className="ml-3 space-y-0.5">
                        <div className="flex items-center gap-2 text-xs font-medium px-1.5 py-0.5 [&:hover]:!bg-accent/50 transition-colors">
                          <SquareFunction className="h-3 w-3 flex-shrink-0" />
                          <span>{func.displayName}</span>
                        </div>
                        <div className="ml-3 space-y-0.5">
                          {params.map((t) => {
                            const param = t.func.inputs[t.paramIndex]
                            const isSource =
                              t.abiKey === sourceAbiKey && t.func.functionId === sourceFunctionId

                            return (
                              <button
                                key={`${t.abiKey}-${t.contractIndex}-${t.func.functionId}-${t.paramIndex}`}
                                type="button"
                                className={cn(
                                  "w-full text-left px-1.5 py-0.5 rounded text-xs transition-colors",
                                  "hover:bg-accent hover:text-accent-foreground",
                                  "bg-background/50 border",
                                  isSource && "opacity-50 cursor-not-allowed"
                                )}
                                onMouseEnter={(e) => {
                                  if (!isSource) {
                                    e.currentTarget.style.backgroundColor = `hsl(var(--accent))`
                                    e.currentTarget.style.color = `hsl(var(--accent-foreground))`
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSource) {
                                    e.currentTarget.style.backgroundColor = ""
                                    e.currentTarget.style.color = ""
                                  }
                                }}
                                onClick={() => handleSelectTarget(t)}
                                disabled={isSource}
                              >
                                <span className="text-muted-foreground">
                                  {param.name || `arg${t.paramIndex}`}
                                </span>{" "}
                                <span className="text-[10px] px-0.5 py-0 rounded bg-muted/50">
                                  {param.type}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Send Encoded Bytes To Function</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ABI, contract, function, or parameter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant={currentChainOnly ? "default" : "outline"}
              onClick={() => setCurrentChainOnly((prev) => !prev)}
              className={cn(
                "text-xs px-2 h-8 flex items-center gap-1.5",
                currentChainOnly ? "bg-primary text-primary-foreground" : ""
              )}
            >
              {currentChainOnly ? (
                <Check className="h-3 w-3" />
              ) : (
                <Square className="h-3 w-3" />
              )}
              Current Chain Only
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md p-2 text-xs">
            {filteredTargets.length === 0 && filteredRecent.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {targets.length === 0
                  ? "No functions with bytes parameters found in your configured contracts."
                  : "No matching functions found for this search."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecent.length > 0 && (
                  <div className="space-y-1 border-b border-border py-2">
                    <div className="flex items-center gap-2 px-1.5 py-1 bg-muted/70 rounded text-xs font-semibold">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      Recent
                    </div>
                    {renderTree(groupedRecent)}
                  </div>
                )}
                {filteredTargets.length > 0 && (
                  <div className="space-y-1">
                    {renderTree(groupedByAbi)}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={listPromptOpen} onOpenChange={setListPromptOpen}>
        <DialogContent className="max-w-xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{listPromptTarget?.func.displayName || "Function"}.bytes[] has existing entries</DialogTitle>
          </DialogHeader>
          <div className="text-sm mb-3">
            Select where to insert your encoded <span className="font-mono">{sourceFunctionName}</span> bytes.
          </div>

          <div className="flex items-center space-x-2 mb-3">
            <Checkbox
              id="clear-existing"
              checked={clearExistingFirst}
              onCheckedChange={(checked) => {
                setClearExistingFirst(checked === true)
                if (checked) {
                  setSelectedInsertIndex(null)
                } else {
                  setSelectedInsertIndex(null)
                }
              }}
            />
            <Label htmlFor="clear-existing" className="text-sm cursor-pointer">
              Clear Existing Data First
            </Label>
          </div>

          <div className="border rounded-md p-3 mb-4 flex-1 min-h-0 overflow-y-auto min-w-[500px]">
            {listPromptExisting && listPromptExisting.length > 0 ? (
              <div className="space-y-2">
                {clearExistingFirst && encodedData && (
                  <div className="w-full flex items-center gap-2">
                    <CirclePlus className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0 p-2 rounded border border-emerald-500/60 bg-emerald-500/10 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                      {encodedData.length > 60 ? `${encodedData.slice(0, 60)}...` : encodedData}
                    </div>
                  </div>
                )}
                {listPromptExisting.map((item, index) => {
                  const isInsertHere = !clearExistingFirst && selectedInsertIndex === index
                  const isInsertAfter = !clearExistingFirst && selectedInsertIndex === index + 1
                  // Show green row BEFORE this item only if selectedInsertIndex === index AND it's the first item (index 0)
                  // Show green row AFTER this item only if selectedInsertIndex === index + 1
                  // This ensures the green row appears exactly once at the correct position
                  const shouldShowGreenBefore = !clearExistingFirst && selectedInsertIndex === index && index === 0 && encodedData
                  const shouldShowGreenAfter = !clearExistingFirst && selectedInsertIndex === index + 1 && encodedData
                  
                  const baseRow = (
                    <div
                      className={cn(
                        "w-full flex items-center gap-2",
                        clearExistingFirst && "opacity-70"
                      )}
                    >
                      {clearExistingFirst ? (
                        <CircleMinus className="h-4 w-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant={isInsertHere ? "default" : "outline"}
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => {
                            setSelectedInsertIndex(index)
                            setClearExistingFirst(false)
                          }}
                        >
                          <ArrowUpCircle className="h-3 w-3" />
                        </Button>
                      )}
                      <div
                        className={cn(
                          "flex-1 min-w-0 p-2 rounded border text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap",
                          clearExistingFirst
                            ? "bg-red-500/10 border-red-500/60"
                            : "bg-muted/30"
                        )}
                      >
                        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{item}</span>
                      </div>
                      {!clearExistingFirst && (
                        <Button
                          type="button"
                          size="icon"
                          variant={isInsertAfter ? "default" : "outline"}
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => {
                            setSelectedInsertIndex(index + 1)
                            setClearExistingFirst(false)
                          }}
                        >
                          <ArrowDownCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )

                  const greenRow = (
                    <div className="w-full flex items-center gap-2">
                      <CirclePlus className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 p-2 rounded border border-emerald-500/60 bg-emerald-500/10 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                        {encodedData && (encodedData.length > 60 ? `${encodedData.slice(0, 60)}...` : encodedData)}
                      </div>
                    </div>
                  )

                  // Render green row before first item if selectedInsertIndex === 0
                  if (shouldShowGreenBefore) {
                    return (
                      <div key={index} className="w-full space-y-1">
                        {greenRow}
                        {baseRow}
                      </div>
                    )
                  }

                  // Render green row after this item if selectedInsertIndex === index + 1
                  if (shouldShowGreenAfter) {
                    return (
                      <div key={index} className="w-full space-y-1">
                        {baseRow}
                        {greenRow}
                      </div>
                    )
                  }

                  return <div key={index} className="w-full">{baseRow}</div>
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No existing entries</div>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-2 mt-auto pt-4 border-t">
            <Button
              type="button"
              variant="default"
              disabled={!clearExistingFirst && selectedInsertIndex === null}
              onClick={async () => {
                if (!encodedData || !listPromptTarget || !listPromptExisting) return
                const { abiKey, func, paramIndex } = listPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}

                let newArray: string[]
                if (clearExistingFirst) {
                  newArray = [encodedData]
                } else if (selectedInsertIndex !== null) {
                  newArray = [
                    ...listPromptExisting.slice(0, selectedInsertIndex),
                    encodedData,
                    ...listPromptExisting.slice(selectedInsertIndex),
                  ]
                } else {
                  return
                }

                const newForm = {
                  ...existingForm,
                  [paramName]: safeStringify(newArray),
                }

                setFormState(abiKey, func.functionId, newForm)
                addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
                setListPromptOpen(false)
                setClearExistingFirst(false)
                setSelectedInsertIndex(null)
                onOpenChange(false)
                onComplete?.()
              }}
            >
              Accept & Return to {sourceFunctionName}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!clearExistingFirst && selectedInsertIndex === null}
              onClick={async () => {
                if (!encodedData || !listPromptTarget || !listPromptExisting) return
                const { abiKey, func, paramIndex, contractIndex } = listPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}

                let newArray: string[]
                if (clearExistingFirst) {
                  newArray = [encodedData]
                } else if (selectedInsertIndex !== null) {
                  newArray = [
                    ...listPromptExisting.slice(0, selectedInsertIndex),
                    encodedData,
                    ...listPromptExisting.slice(selectedInsertIndex),
                  ]
                } else {
                  return
                }

                const newForm = {
                  ...existingForm,
                  [paramName]: safeStringify(newArray),
                }

                setSelectedAbiKey(abiKey)
                setSelectedAddress(abiKey, contractIndex)
                setSelectedFunction(abiKey, func.functionId)
                setFormState(abiKey, func.functionId, newForm)
                addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
                setListPromptOpen(false)
                setClearExistingFirst(false)
                setSelectedInsertIndex(null)
                onOpenChange(false)
              }}
            >
              Accept & Go to {listPromptTarget?.func.displayName || "destination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bytesPromptOpen} onOpenChange={setBytesPromptOpen}>
        <DialogContent className="max-w-xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bytes Parameter Already Has Value</DialogTitle>
          </DialogHeader>
          <div className="text-sm mb-3">
            There is an existing value in this <code>bytes</code> parameter already.
          </div>
          <div className="border rounded-md p-2 mb-4 max-h-40 overflow-y-auto">
            <ResultRenderer value={bytesPromptExisting ?? ""} defaultFormat="yaml" />
          </div>
          <div className="text-sm mb-3">
            How should we apply your encoded <span className="font-mono">{sourceFunctionName}</span> function?
          </div>
          <div className="flex items-center justify-end gap-2 mt-auto pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBytesPromptOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!encodedData || !bytesPromptTarget) return
                const { abiKey, func, paramIndex } = bytesPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}
                const newForm = {
                  ...existingForm,
                  [paramName]: encodedData,
                }
                setFormState(abiKey, func.functionId, newForm)
                addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
                setBytesPromptOpen(false)
                onOpenChange(false)
                onComplete?.()
              }}
            >
              Accept & Return to {sourceFunctionName}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!encodedData || !bytesPromptTarget) return
                const { abiKey, func, paramIndex, contractIndex } = bytesPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}
                const newForm = {
                  ...existingForm,
                  [paramName]: encodedData,
                }
                setSelectedAbiKey(abiKey)
                setSelectedAddress(abiKey, contractIndex)
                setSelectedFunction(abiKey, func.functionId)
                setFormState(abiKey, func.functionId, newForm)
                addEncodeDestination({ abiKey, functionId: func.functionId, paramIndex })
                setBytesPromptOpen(false)
                onOpenChange(false)
              }}
            >
              Accept & Go to {bytesPromptTarget?.func.displayName || "destination"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
