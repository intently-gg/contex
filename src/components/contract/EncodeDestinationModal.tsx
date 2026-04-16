import {
  useMemo,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react"
import type { Abi } from "viem"
import { useChainId } from "wagmi"
import { useABIStore } from "@/stores/abiStore"
import { useContractStore } from "@/stores/contractStore"
import { parseABI, type ParsedFunction } from "@/lib/abiParser"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Search,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  CirclePlus,
  CircleMinus,
  FileCode,
  Scroll,
  SquareFunction,
  Check,
  Square,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  cn,
  truncateLabel,
  safeStringify,
  extractFunctionSelector,
  findFunctionBySignature,
} from "@/lib/utils"

interface EncodeDestinationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  encodedData: string | null
  sourceAbiKey: string
  sourceFunctionId: string
  sourceFunctionName: string
  onComplete?: () => void
}

export type EncodeDestinationModalHandle = {
  applyLastDestination: (encodedData: string) => boolean
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

export const EncodeDestinationModal = forwardRef<
  EncodeDestinationModalHandle,
  EncodeDestinationModalProps
>(function EncodeDestinationModal(
  {
    open,
    onOpenChange,
    encodedData,
    sourceAbiKey,
    sourceFunctionId,
    sourceFunctionName,
    onComplete,
  },
  ref
) {
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
    setLastEncodeSendTarget,
  } = useContractStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentChainOnly, setCurrentChainOnly] = useState(true)
  const [currentContractOnly, setCurrentContractOnly] = useState(true)
  const [byteArraysOnly, setByteArraysOnly] = useState(true)
  const [listPromptOpen, setListPromptOpen] = useState(false)
  const [listPromptTarget, setListPromptTarget] = useState<ByteParamTarget | null>(null)
  const [listPromptExisting, setListPromptExisting] = useState<string[] | null>(null)
  const [clearExistingFirst, setClearExistingFirst] = useState(false)
  const [selectedInsertIndex, setSelectedInsertIndex] = useState<number | null>(null)
  const chainId = useChainId()

  // Default: append new bytes at end of list (or sole new item when empty)
  useEffect(() => {
    if (listPromptOpen && listPromptExisting !== null) {
      setClearExistingFirst(false)
      setSelectedInsertIndex(listPromptExisting.length)
    }
  }, [listPromptOpen, listPromptExisting])

  const calldataDisplayName = useCallback(
    (raw: string): string | null => {
      const selector = extractFunctionSelector(raw)
      if (!selector) return null
      const match = findFunctionBySignature(selector, abis)
      return match?.func.name ?? null
    },
    [abis]
  )

  const bytesListRowInner = (raw: string, explicitLabel: string | null) => {
    const decoded = explicitLabel ?? calldataDisplayName(raw)
    const hex = raw.trim()
    if (!decoded) {
      return (
        <span className="min-w-0 truncate">{hex}</span>
      )
    }
    return (
      <>
        <span className="shrink-0 font-medium text-foreground">{decoded}</span>
        <span className="shrink-0">:</span>
        <span className="min-w-0 truncate pl-0.5">{hex}</span>
      </>
    )
  }

  const isBytesType = (type: string): boolean => {
    const normalized = type.toLowerCase().trim()
    return normalized === "bytes" || normalized === "bytes[]"
  }

  const isBytesArrayOnlyType = (type: string): boolean => {
    return type.toLowerCase().trim() === "bytes[]"
  }

  const paramMatchesByteFilter = (inputType: string): boolean => {
    if (byteArraysOnly) return isBytesArrayOnlyType(inputType)
    return isBytesType(inputType)
  }

  const targets = useMemo<ByteParamTarget[]>(() => {
    const items: ByteParamTarget[] = []

    for (const [abiKey, entry] of Object.entries(abis)) {
      if (currentContractOnly && abiKey !== sourceAbiKey) continue

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
          if (paramMatchesByteFilter(input.type)) {
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
  }, [
    abis,
    contracts,
    currentChainOnly,
    chainId,
    currentContractOnly,
    sourceAbiKey,
    byteArraysOnly,
  ])

  const commitEncodeDestination = useCallback(
    (target: ByteParamTarget) => {
      addEncodeDestination({
        abiKey: target.abiKey,
        functionId: target.func.functionId,
        paramIndex: target.paramIndex,
      })
      setLastEncodeSendTarget({
        abiKey: target.abiKey,
        functionId: target.func.functionId,
        paramIndex: target.paramIndex,
        contractAddress: target.contractAddress,
        funcDisplayName: target.func.displayName,
      })
    },
    [addEncodeDestination, setLastEncodeSendTarget]
  )

  const resolveLastTargetFromStore = useCallback((): ByteParamTarget | null => {
    const last = useContractStore.getState().lastEncodeSendTarget
    if (!last) return null
    const entry = abis[last.abiKey]
    const contractEntries = contracts[last.abiKey]
    if (!entry || !contractEntries?.length) return null

    const abi = entry.abi as Abi | undefined
    if (!abi) return null
    const parsed = parseABI(abi)
    if (!parsed) return null
    const func = parsed.find((f) => f.functionId === last.functionId)
    if (!func) return null
    const param = func.inputs[last.paramIndex]
    if (!param) return null
    const normalized = param.type.toLowerCase().trim()
    if (normalized !== "bytes" && normalized !== "bytes[]") return null

    const eligibleAddresses = currentChainOnly
      ? contractEntries.filter((addr) => addr.chainIds.includes(chainId))
      : contractEntries

    const idx = eligibleAddresses.findIndex(
      (c) => c.address.toLowerCase() === last.contractAddress.toLowerCase()
    )
    if (idx === -1) return null

    const contract = eligibleAddresses[idx]
    return {
      abiKey: last.abiKey,
      abiLabel: entry.label,
      contractIndex: idx,
      contractLabel: contract.label,
      contractAddress: contract.address,
      func,
      paramIndex: last.paramIndex,
      isArray: normalized.includes("[]"),
    }
  }, [abis, contracts, chainId, currentChainOnly])

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

  const handleSelectTarget = useCallback(
    (target: ByteParamTarget, encodedOverride?: string) => {
    const data = encodedOverride ?? encodedData
    if (!data) return

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

    const applyBytesValue = (value: string) => {
      const newForm = {
        ...existingForm,
        [paramName]: value,
      }

      setSelectedAbiKey(abiKey)
      setSelectedAddress(abiKey, contractIndex)
      setSelectedFunction(abiKey, func.functionId)
      setFormState(abiKey, func.functionId, newForm)
      commitEncodeDestination(target)
      onComplete?.()
    }

    if (isList) {
      let existingArray: string[]
      if (!existingValue) {
        existingArray = []
      } else {
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
      }

      setListPromptTarget(target)
      setListPromptExisting(existingArray)
      setListPromptOpen(true)
      return
    }

    applyBytesValue(data)
    onOpenChange(false)
  },
    [
      encodedData,
      contracts,
      currentChainOnly,
      chainId,
      getFormState,
      setSelectedAbiKey,
      setSelectedAddress,
      setSelectedFunction,
      setFormState,
      commitEncodeDestination,
      onComplete,
      onOpenChange,
    ]
  )

  useImperativeHandle(
    ref,
    () => ({
      applyLastDestination: (data: string) => {
        if (!data.trim()) return false
        const resolved = resolveLastTargetFromStore()
        if (!resolved) return false
        if (
          resolved.abiKey === sourceAbiKey &&
          resolved.func.functionId === sourceFunctionId
        ) {
          return false
        }
        handleSelectTarget(resolved, data)
        return true
      },
    }),
    [
      resolveLastTargetFromStore,
      sourceAbiKey,
      sourceFunctionId,
      handleSelectTarget,
    ]
  )

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

          <div className="space-y-2 mb-3">
            <div className="relative w-full">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ABI, contract, function, or parameter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex flex-nowrap gap-1.5 w-full">
              <Button
                type="button"
                variant={currentContractOnly ? "default" : "outline"}
                onClick={() => setCurrentContractOnly((prev) => !prev)}
                className={cn(
                  "text-[11px] px-2 h-8 flex-1 min-w-0 flex items-center justify-center gap-1",
                  currentContractOnly ? "bg-primary text-primary-foreground" : ""
                )}
              >
                {currentContractOnly ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Square className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">Current Contract Only</span>
              </Button>
              <Button
                type="button"
                variant={currentChainOnly ? "default" : "outline"}
                onClick={() => setCurrentChainOnly((prev) => !prev)}
                className={cn(
                  "text-[11px] px-2 h-8 flex-1 min-w-0 flex items-center justify-center gap-1",
                  currentChainOnly ? "bg-primary text-primary-foreground" : ""
                )}
              >
                {currentChainOnly ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Square className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">Current Chain Only</span>
              </Button>
              <Button
                type="button"
                variant={byteArraysOnly ? "default" : "outline"}
                onClick={() => setByteArraysOnly((prev) => !prev)}
                className={cn(
                  "text-[11px] px-2 h-8 flex-1 min-w-0 flex items-center justify-center gap-1",
                  byteArraysOnly ? "bg-primary text-primary-foreground" : ""
                )}
              >
                {byteArraysOnly ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Square className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">Byte Arrays Only</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md p-2 text-xs">
            {filteredTargets.length === 0 && filteredRecent.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {targets.length === 0
                  ? "No matching byte parameter slots with the current filters. Try widening contract, chain, or byte-array filters."
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
        <DialogContent className="max-w-[min(54rem,calc(100vw-2rem))] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug pr-6">
              {listPromptTarget ? (
                <>
                  Encoding to {listPromptTarget.contractLabel} 🠊{" "}
                  {listPromptTarget.func.displayName} 🠊{" "}
                  {(() => {
                    const p = listPromptTarget.func.inputs[listPromptTarget.paramIndex]
                    return p.name && p.name.length > 0 ? p.name : `arg${listPromptTarget.paramIndex}`
                  })()}
                </>
              ) : (
                "Encoding to bytes[]"
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-3">
            New item is placed at the end by default. Use the arrows to insert elsewhere.
          </div>

          {listPromptExisting !== null && listPromptExisting.length > 0 ? (
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="clear-existing"
                checked={clearExistingFirst}
                onCheckedChange={(checked) => {
                  const on = checked === true
                  setClearExistingFirst(on)
                  if (!on && listPromptExisting) {
                    setSelectedInsertIndex(listPromptExisting.length)
                  }
                }}
              />
              <Label htmlFor="clear-existing" className="text-sm cursor-pointer">
                Clear existing first
              </Label>
            </div>
          ) : null}

          <div className="border rounded-md p-3 mb-4 flex-1 min-h-0 overflow-y-auto min-w-[min(750px,100%)]">
            {listPromptExisting && listPromptExisting.length === 0 && encodedData ? (
              <div className="w-full flex items-center gap-2">
                <CirclePlus className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0 p-2 rounded border border-emerald-500/60 bg-emerald-500/10 text-xs font-mono flex items-center gap-0 overflow-hidden whitespace-nowrap">
                  {bytesListRowInner(encodedData, sourceFunctionName)}
                </div>
              </div>
            ) : null}
            {listPromptExisting && listPromptExisting.length > 0 ? (
              <div className="space-y-2">
                {clearExistingFirst && encodedData && (
                  <div className="w-full flex items-center gap-2">
                    <CirclePlus className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0 p-2 rounded border border-emerald-500/60 bg-emerald-500/10 text-xs font-mono flex items-center gap-0 overflow-hidden whitespace-nowrap">
                      {bytesListRowInner(encodedData, sourceFunctionName)}
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
                          "flex-1 min-w-0 p-2 rounded border text-xs font-mono flex items-center gap-0 overflow-hidden whitespace-nowrap",
                          clearExistingFirst
                            ? "bg-red-500/10 border-red-500/60"
                            : "bg-muted/30"
                        )}
                      >
                        {bytesListRowInner(item, null)}
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
                      <div className="flex-1 min-w-0 p-2 rounded border border-emerald-500/60 bg-emerald-500/10 text-xs font-mono flex items-center gap-0 overflow-hidden whitespace-nowrap">
                        {encodedData
                          ? bytesListRowInner(encodedData, sourceFunctionName)
                          : null}
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
            ) : null}
          </div>

          <div className="flex flex-row items-stretch gap-2 mt-auto pt-4 border-t">
            <Button
              type="button"
              variant="default"
              className="flex-1"
              disabled={!encodedData || !listPromptTarget || listPromptExisting === null}
              onClick={async () => {
                if (!encodedData || !listPromptTarget || listPromptExisting === null) return
                const { abiKey, func, paramIndex } = listPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}
                const existing = listPromptExisting

                let newArray: string[]
                if (clearExistingFirst) {
                  newArray = [encodedData]
                } else {
                  const at = selectedInsertIndex ?? existing.length
                  newArray = [
                    ...existing.slice(0, at),
                    encodedData,
                    ...existing.slice(at),
                  ]
                }

                const newForm = {
                  ...existingForm,
                  [paramName]: safeStringify(newArray),
                }

                setFormState(abiKey, func.functionId, newForm)
                commitEncodeDestination(listPromptTarget)
                setListPromptOpen(false)
                setClearExistingFirst(false)
                setSelectedInsertIndex(null)
                onOpenChange(false)
                onComplete?.()
              }}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 mr-2" />
              Accept & Return to {sourceFunctionName}
            </Button>
            <Button
              type="button"
              variant="default"
              className="flex-1"
              disabled={!encodedData || !listPromptTarget || listPromptExisting === null}
              onClick={async () => {
                if (!encodedData || !listPromptTarget || listPromptExisting === null) return
                const { abiKey, func, paramIndex, contractIndex } = listPromptTarget
                const param = func.inputs[paramIndex]
                const paramName = param.name && param.name.length > 0 ? param.name : `arg${paramIndex}`
                const existingForm = getFormState(abiKey, func.functionId) || {}
                const existing = listPromptExisting

                let newArray: string[]
                if (clearExistingFirst) {
                  newArray = [encodedData]
                } else {
                  const at = selectedInsertIndex ?? existing.length
                  newArray = [
                    ...existing.slice(0, at),
                    encodedData,
                    ...existing.slice(at),
                  ]
                }

                const newForm = {
                  ...existingForm,
                  [paramName]: safeStringify(newArray),
                }

                setSelectedAbiKey(abiKey)
                setSelectedAddress(abiKey, contractIndex)
                setSelectedFunction(abiKey, func.functionId)
                setFormState(abiKey, func.functionId, newForm)
                commitEncodeDestination(listPromptTarget)
                setListPromptOpen(false)
                setClearExistingFirst(false)
                setSelectedInsertIndex(null)
                onOpenChange(false)
              }}
            >
              Accept & Go to {listPromptTarget?.func.displayName || "destination"}
              <ArrowRight className="h-4 w-4 shrink-0 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
