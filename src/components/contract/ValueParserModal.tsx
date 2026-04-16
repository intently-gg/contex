import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { parseUnits, formatUnits } from "viem"
import { toast } from "sonner"
import { Copy, Check, RefreshCw, Minus, Plus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { copyToClipboard } from "@/lib/utils"
import { useChains, useChainId } from "wagmi"
import { createPublicClient, http } from "viem"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"

interface ValueParserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: (value: string) => void
  fieldName: string
  fieldType: string
  currentValue?: string
  abiKey?: string
  address?: string
  functionName?: string
  disconnected?: boolean // If true, show Copy button instead of Apply
}

// In-memory storage for decimals per parameter
const decimalsMemory: Record<string, string> = {}

function getMemoryKey(abiKey: string, address: string, functionName: string, fieldName: string): string {
  return `${abiKey}:${address}:${functionName}:${fieldName}`
}

function rememberIntegerDecimals(memoryKey: string | null, decimalsStr: string) {
  if (memoryKey) {
    decimalsMemory[memoryKey] = decimalsStr
  }
}

function formatUnixTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  const absDiff = Math.abs(diff)
  const isFuture = diff < 0
  
  const years = Math.floor(absDiff / 31536000)
  const days = Math.floor((absDiff % 31536000) / 86400)
  const hours = Math.floor((absDiff % 86400) / 3600)
  const minutes = Math.floor((absDiff % 3600) / 60)
  const secs = absDiff % 60
  
  const parts: string[] = []
  if (years > 0) parts.push(`${years}y`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  
  const timeStr = parts.join(" ")
  return isFuture ? `in ${timeStr}` : `${timeStr} ago`
}

function validateUnixTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  const maxFuture = now + (55 * 365 * 24 * 60 * 60)
  const maxPast = now - (15 * 365 * 24 * 60 * 60)
  return timestamp >= maxPast && timestamp <= maxFuture
}

// Hover-based increment menu component
function IncrementMenu({
  onIncrement,
  increments,
  trigger,
}: {
  onIncrement: (value: number) => void
  increments: { label: string; value: number }[]
  trigger: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {trigger}
      {isOpen && (
        <div 
          className="absolute bottom-full right-0 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md"
          style={{ 
            backgroundColor: 'hsl(var(--popover))',
            color: 'hsl(var(--popover-foreground))',
            marginBottom: 0,
            paddingTop: '2px'
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {increments.map((inc) => (
            <button
              key={inc.value}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[hovered]:bg-accent data-[hovered]:text-accent-foreground"
              onClick={() => onIncrement(inc.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                e.currentTarget.style.color = 'hsl(var(--accent-foreground))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = ''
              }}
            >
              {inc.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getDefaultTab(fieldName: string): string {
  const lowerName = fieldName.toLowerCase()
  
  // Check for block/chain related first (takes precedence)
  if ((lowerName.includes("block") || lowerName.includes("chain")) && 
      (lowerName.includes("time") || lowerName.includes("date") || lowerName.includes("deadline") || 
       lowerName.includes("expiration") || lowerName.includes("expire") || lowerName.includes("expiry"))) {
    return "chain"
  }
  
  // Check for time/date related
  if (lowerName.includes("time") || lowerName.includes("date") || lowerName.includes("deadline") || 
      lowerName.includes("expiration") || lowerName.includes("expire") || lowerName.includes("expiry")) {
    return "unix-seconds"
  }
  
  // Check for chain/network id
  if ((lowerName.includes("chain") || lowerName.includes("network")) && lowerName.includes("id")) {
    return "chain"
  }
  
  // Check if just "chain"
  if (lowerName === "chain") {
    return "chain"
  }
  
  // Default to Integer
  return "uint"
}

export function ValueParserModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  fieldType,
  currentValue = "",
  abiKey = "",
  address = "",
  functionName = "",
  disconnected = false,
}: ValueParserModalProps) {
  const chains = useChains()
  const chainId = useChainId()
  const isWei = fieldType.toLowerCase().includes("wei") || fieldName.toLowerCase().includes("wei")
  const memoryKey = abiKey && address && functionName 
    ? getMemoryKey(abiKey, address, functionName, fieldName)
    : null
  
  // Initialize decimals from memory or default (18 matches ether / typical ERC-20 units)
  const [decimals, setDecimals] = useState(() => {
    if (memoryKey && decimalsMemory[memoryKey]) {
      return decimalsMemory[memoryKey]
    }
    return "18"
  })
  const [units, setUnits] = useState("")
  const previewRef = useRef<HTMLDivElement | null>(null)
  
  // Unix Seconds state
  const [unixSeconds, setUnixSeconds] = useState(() => Math.floor(Date.now() / 1000).toString())
  const unixValueRef = useRef<HTMLDivElement | null>(null)
  
  // Chain state
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [chainMode, setChainMode] = useState<"chainId" | "blockNumber">("chainId")
  const [blockNumber, setBlockNumber] = useState("")
  const [blockTimestamp, setBlockTimestamp] = useState<{ unix: number; formatted: string; timeAgo: string } | null>(null)
  const [isLoadingBlock, setIsLoadingBlock] = useState(false)
  const chainPreviewRef = useRef<HTMLDivElement | null>(null)
  const blockNumberRef = useRef<HTMLDivElement | null>(null)
  const blockTimestampRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedChainId(chainId)
      setUnixSeconds(Math.floor(Date.now() / 1000).toString())
      setBlockTimestamp(null)
      setBlockNumber("")
      
      // Set chain mode based on parameter name
      const lowerName = fieldName.toLowerCase()
      if ((lowerName.includes("chain") || lowerName.includes("network")) && lowerName.includes("id")) {
        setChainMode("chainId")
      } else if (lowerName.includes("block") || (lowerName.includes("chain") && (lowerName.includes("time") || lowerName.includes("date") || lowerName.includes("deadline") || lowerName.includes("expiration") || lowerName.includes("expire") || lowerName.includes("expiry")))) {
        setChainMode("blockNumber")
      }
      
      // Decode the field's raw integer into units using this modal's decimal scale
      // (decimals state persists per field instance; memoryKey backs remounts via rememberIntegerDecimals)
      if (currentValue?.trim()) {
        try {
          const d = Number.parseInt(decimals, 10)
          if (Number.isNaN(d) || d < 0) {
            setUnits("")
          } else {
            setUnits(formatUnits(BigInt(currentValue.trim()), d))
          }
        } catch {
          setUnits("")
        }
      } else {
        setUnits("")
      }
    } else {
      setUnits("")
    }
    // decimals omitted on purpose: only sync units when dialog open state or field value changes,
    // not when the user edits the decimals input (would overwrite units mid-edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [open, currentValue, memoryKey, chainId, fieldName])

  // Real-time preview calculation for uint
  const preview = useMemo(() => {
    if (!units || !decimals) return null
    
    const decimalsNum = Number.parseInt(decimals, 10)

    if (Number.isNaN(decimalsNum)) {
      return { type: 'error' as const, message: 'Invalid decimals value' }
    }

    const trimmedUnits = units.trim()
    
    const decimalPart = trimmedUnits.includes(".") ? trimmedUnits.split(".")[1] : ""
    if (decimalPart.length > decimalsNum) {
      return { 
        type: 'error' as const, 
        message: `Units have ${decimalPart.length} decimal places, but only ${decimalsNum} decimals are allowed` 
      }
    }

    try {
      const weiValue = parseUnits(trimmedUnits, decimalsNum)
      return { type: 'value' as const, value: weiValue.toString() }
    } catch (error) {
      return { 
        type: 'error' as const, 
        message: error instanceof Error ? error.message : 'Failed to parse value' 
      }
    }
  }, [units, decimals])

  // Unix Seconds preview
  const unixPreview = useMemo(() => {
    if (!unixSeconds.trim()) return null
    
    const timestamp = Number.parseInt(unixSeconds.trim(), 10)
    if (Number.isNaN(timestamp)) {
      return { type: 'error' as const, message: 'Invalid unix timestamp' }
    }
    
    if (!validateUnixTimestamp(timestamp)) {
      return { type: 'error' as const, message: 'Timestamp out of practical range' }
    }
    
    return {
      type: 'value' as const,
      value: timestamp.toString(),
      formatted: formatUnixTimestamp(timestamp),
      timeAgo: formatTimeAgo(timestamp),
    }
  }, [unixSeconds])

  const handlePreset = (presetDecimals: string) => {
    setDecimals(presetDecimals)
    rememberIntegerDecimals(memoryKey, presetDecimals)
  }

  const [copied, setCopied] = useState(false)

  const handleCopy = async (value: string, ref?: React.RefObject<HTMLDivElement | null>) => {
    if (!value) {
      toast.error("No value to copy")
      return
    }
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
        toast.success("Copied to clipboard")
        return
      }
    } catch {
      // Fall through to Selection API fallback
    }
    
    // Fallback: Select from preview element using Selection API
    try {
      const node = ref?.current
      if (node) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
          const successful = document.execCommand("copy")
          selection.removeAllRanges()
          
          if (successful) {
            setCopied(true)
            setTimeout(() => setCopied(false), 1000)
            toast.success("Copied to clipboard")
            return
          }
        }
      }
    } catch {
      // Fall through to error
    }
    
    toast.error("Failed to copy. Please select and copy manually.")
  }

  const handleApply = async (value: string) => {
    if (disconnected) {
      const success = await copyToClipboard(value)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
        toast.success("Copied to clipboard")
      } else {
        toast.error("Failed to copy to clipboard")
      }
    } else if (onApply) {
      onApply(value)
      onOpenChange(false)
    }
  }

  const handleUnixAdjust = (seconds: number) => {
    const current = Number.parseInt(unixSeconds.trim() || "0", 10)
    if (Number.isNaN(current)) {
      setUnixSeconds(Math.floor(Date.now() / 1000).toString())
      return
    }
    setUnixSeconds((current + seconds).toString())
  }

  const handleGetCurrentUnix = () => {
    setUnixSeconds(Math.floor(Date.now() / 1000).toString())
  }

  const handleBlockAdjust = (blocks: number) => {
    const current = Number.parseInt(blockNumber.trim() || "0", 10)
    if (Number.isNaN(current)) {
      setBlockNumber("0")
      return
    }
    const newValue = Math.max(0, current + blocks)
    setBlockNumber(newValue.toString())
  }

  const handleGetCurrentBlock = async () => {
    if (!selectedChainId) {
      toast.error("Please select a chain first")
      return
    }

    setIsLoadingBlock(true)
    try {
      const chain = chains.find((c) => c.id === selectedChainId)
      if (!chain) {
        throw new Error("Selected chain not found")
      }

      const client = createPublicClient({
        chain,
        transport: http(),
      })

      const blockNumber = await client.getBlockNumber()
      setBlockNumber(blockNumber.toString())
    } catch (error) {
      console.error("Error fetching current block:", error)
      toast.error("Failed to fetch current block number")
    } finally {
      setIsLoadingBlock(false)
    }
  }

  const fetchBlockTimestamp = useCallback(async (blockNum: number) => {
    if (!selectedChainId) {
      return
    }

    setIsLoadingBlock(true)

    try {
      const chain = chains.find((c) => c.id === selectedChainId)
      if (!chain) {
        throw new Error("Selected chain not found")
      }

      const client = createPublicClient({
        chain,
        transport: http(),
      })

      const block = await client.getBlock({ blockNumber: BigInt(blockNum) })
      const timestamp = Number(block.timestamp)
      
      setBlockTimestamp({
        unix: timestamp,
        formatted: formatUnixTimestamp(timestamp),
        timeAgo: formatTimeAgo(timestamp),
      })
    } catch (error) {
      console.error("Error fetching block timestamp:", error)
      setBlockTimestamp(null)
    } finally {
      setIsLoadingBlock(false)
    }
  }, [selectedChainId, chains])

  // Debounce block number changes to auto-fetch timestamp
  useEffect(() => {
    if (chainMode !== "blockNumber" || !selectedChainId || !blockNumber.trim()) {
      setBlockTimestamp(null)
      return
    }

    const blockNum = Number.parseInt(blockNumber.trim(), 10)
    if (Number.isNaN(blockNum) || blockNum < 0) {
      setBlockTimestamp(null)
      return
    }

    const timeoutId = setTimeout(() => {
      fetchBlockTimestamp(blockNum)
    }, 750)

    return () => clearTimeout(timeoutId)
  }, [blockNumber, selectedChainId, chainMode, fetchBlockTimestamp])

  const renderPreview = (
    preview: { type: 'value' | 'error'; value?: string; message?: string; formatted?: string; timeAgo?: string } | null,
    ref: React.RefObject<HTMLDivElement | null>,
    showFormatted?: boolean
  ) => {
    if (!preview) {
      return (
        <div className="rounded-md bg-muted p-3 text-sm border flex-1 font-mono min-h-[42px] flex items-center text-muted-foreground">
          Enter values to see preview
        </div>
      )
    }

    if (preview.type === 'error') {
      return (
        <div className="flex items-start gap-2 text-sm break-words min-h-[42px]" style={{ color: '#ec4899' }}>
          <span className="flex-shrink-0 mt-0.5">×</span>
          <span className="break-words">{preview.message}</span>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div 
            ref={ref}
            className="rounded-md bg-muted p-3 text-sm border flex-1 font-mono select-all cursor-text"
            onClick={(e) => {
              const range = document.createRange()
              range.selectNodeContents(e.currentTarget)
              const selection = window.getSelection()
              if (selection) {
                selection.removeAllRanges()
                selection.addRange(range)
              }
            }}
          >
            {preview.value}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => handleCopy(preview.value || "", ref)}
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
        {showFormatted && preview.formatted && (
          <div className="text-sm text-muted-foreground pl-1">
            {preview.formatted} ({preview.timeAgo})
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl min-h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Integer Helper</DialogTitle>
          <DialogDescription>
            Parse integer values from decimals and units, work with unix timestamps, and check block timestamps
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex-1 flex flex-col min-h-0">
          <Tabs defaultValue={getDefaultTab(fieldName)} className="flex flex-col h-full">
            <div className="flex flex-col flex-1 pt-2">
              <TabsList>
                <TabsTrigger value="uint">Integer</TabsTrigger>
                <TabsTrigger value="unix-seconds">Unix Seconds</TabsTrigger>
                <TabsTrigger value="chain">Chain</TabsTrigger>
              </TabsList>
              <div className="flex-1 mt-3">
                <TabsContent value="uint" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="units">Units</Label>
                    <Input
                      id="units"
                      type="number"
                      step="any"
                      value={units}
                      onChange={(e) => setUnits(e.target.value)}
                      placeholder="12.345"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: 12.345 with 6 decimals = 12345000
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decimals">Decimals</Label>
                    <div className="flex gap-2">
                      <Input
                        id="decimals"
                        type="number"
                        value={decimals}
                        onChange={(e) => setDecimals(e.target.value)}
                        placeholder="18"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreset("6")}
                      >
                        6
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreset("8")}
                      >
                        8
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreset("18")}
                      >
                        18
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Default: 18{isWei ? " (wei/ether)" : ""}. You can override.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    {renderPreview(preview, previewRef)}
                  </div>
                  <DialogFooter className="sm:justify-start">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    {!disconnected && preview && preview.type === 'value' && (
                      <Button
                        onClick={() => {
                          rememberIntegerDecimals(memoryKey, decimals)
                          handleApply(preview.value!)
                        }}
                      >
                        Apply
                      </Button>
                    )}
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="unix-seconds" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="unix-seconds">Unix Seconds</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="unix-seconds"
                        type="text"
                        value={unixSeconds}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "")
                          setUnixSeconds(val)
                        }}
                        className="font-mono"
                        style={{ width: '250px' }}
                        placeholder="Unix seconds"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleGetCurrentUnix}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Get Current</TooltipContent>
                      </Tooltip>
                      <IncrementMenu
                        onIncrement={handleUnixAdjust}
                        increments={[
                          { label: "-1 month", value: -2592000 },
                          { label: "-1d", value: -86400 },
                          { label: "-1h", value: -3600 },
                          { label: "-30m", value: -1800 },
                          { label: "-1m", value: -60 },
                        ]}
                        trigger={
                          <Button variant="outline" size="icon">
                            <Minus className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <IncrementMenu
                        onIncrement={handleUnixAdjust}
                        increments={[
                          { label: "+1 month", value: 2592000 },
                          { label: "+1d", value: 86400 },
                          { label: "+1h", value: 3600 },
                          { label: "+30m", value: 1800 },
                          { label: "+1m", value: 60 },
                        ]}
                        trigger={
                          <Button variant="outline" size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        }
                      />
                      {unixPreview && unixPreview.type === 'value' && (
                        <>
                          <div 
                            ref={unixValueRef}
                            className="absolute -left-[9999px] opacity-0 pointer-events-none"
                            style={{ position: 'absolute', left: '-9999px' }}
                          >
                            {unixPreview.value}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleCopy(unixPreview.value || "", unixValueRef)}
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
                          {!disconnected && (
                            <Button onClick={() => handleApply(unixPreview.value!)}>
                              Apply
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    {unixPreview && unixPreview.type === 'value' && (
                      <div className="text-sm text-muted-foreground">
                        {unixPreview.formatted} ({unixPreview.timeAgo})
                      </div>
                    )}
                  </div>
                  <DialogFooter className="sm:justify-start">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="chain" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="chain-select">Chain</Label>
                    <Select
                      value={selectedChainId?.toString() || ""}
                      onValueChange={(value) => setSelectedChainId(Number(value))}
                    >
                      <SelectTrigger id="chain-select">
                        <SelectValue placeholder="Select a chain" />
                      </SelectTrigger>
                      <SelectContent>
                        {chains.map((chain) => {
                          const iconUrl = (chain as any).iconUrl || ((chain.nativeCurrency as any)?.iconUrl)
                          const iconBackground = (chain as any).iconBackground || '#d3d3d3'
                          return (
                            <SelectItem key={chain.id} value={chain.id.toString()}>
                              <div className="flex items-center gap-2">
                                <img
                                  src={iconUrl || DEFAULT_CHAIN_ICON}
                                  alt={chain.name}
                                  className="w-4 h-4 rounded-full flex-shrink-0"
                                  onError={(e) => {
                                    e.preventDefault()
                                    const target = e.target as HTMLImageElement
                                    if (target.src !== DEFAULT_CHAIN_ICON) {
                                      target.src = DEFAULT_CHAIN_ICON
                                    }
                                  }}
                                  style={{
                                    backgroundColor: iconBackground,
                                  }}
                                />
                                <span>{chain.name} (id: {chain.id})</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-center">
                    <RadioGroup
                      value={chainMode}
                      onValueChange={(value) => setChainMode(value as "chainId" | "blockNumber")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="chainId" id="chain-id" />
                        <Label htmlFor="chain-id" className="text-sm cursor-pointer">
                          Chain Id
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="blockNumber" id="block-number-mode" />
                        <Label htmlFor="block-number-mode" className="text-sm cursor-pointer">
                          Block Number
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {chainMode === "chainId" && (
                    <div className="space-y-2">
                      <Label>Chain ID</Label>
                      <div className="flex items-center gap-2">
                        <div 
                          ref={chainPreviewRef}
                          className="rounded-md bg-muted p-3 text-sm border font-mono select-all cursor-text"
                          style={{ width: '250px' }}
                          onClick={(e) => {
                            const range = document.createRange()
                            range.selectNodeContents(e.currentTarget)
                            const selection = window.getSelection()
                            if (selection) {
                              selection.removeAllRanges()
                              selection.addRange(range)
                            }
                          }}
                        >
                          {selectedChainId ?? "Select a chain"}
                        </div>
                        {selectedChainId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => handleCopy(selectedChainId.toString(), chainPreviewRef)}
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
                        )}
                      </div>
                    </div>
                  )}
                  {chainMode === "blockNumber" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="block-number">Block Number</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="block-number"
                            type="text"
                            value={blockNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "")
                              setBlockNumber(val)
                            }}
                            className="font-mono"
                            style={{ width: '250px' }}
                            placeholder="Block number"
                            disabled={!selectedChainId}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={handleGetCurrentBlock}
                                disabled={isLoadingBlock || !selectedChainId}
                              >
                                <RefreshCw className={`h-4 w-4 ${isLoadingBlock ? 'animate-spin' : ''}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Get Current</TooltipContent>
                          </Tooltip>
                          <IncrementMenu
                            onIncrement={handleBlockAdjust}
                            increments={[
                              { label: "-100K", value: -100000 },
                              { label: "-10K", value: -10000 },
                              { label: "-1000", value: -1000 },
                              { label: "-100", value: -100 },
                              { label: "-10", value: -10 },
                              { label: "-1", value: -1 },
                            ]}
                            trigger={
                              <Button variant="outline" size="icon" disabled={!selectedChainId}>
                                <Minus className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <IncrementMenu
                            onIncrement={handleBlockAdjust}
                            increments={[
                              { label: "+100K", value: 100000 },
                              { label: "+10K", value: 10000 },
                              { label: "+1000", value: 1000 },
                              { label: "+100", value: 100 },
                              { label: "+10", value: 10 },
                              { label: "+1", value: 1 },
                            ]}
                            trigger={
                              <Button variant="outline" size="icon" disabled={!selectedChainId}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            }
                          />
                          {blockNumber.trim() && (
                            <>
                              <div 
                                ref={blockNumberRef}
                                className="absolute -left-[9999px] opacity-0 pointer-events-none"
                                style={{ position: 'absolute', left: '-9999px' }}
                              >
                                {blockNumber}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleCopy(blockNumber, blockNumberRef)}
                                  >
                                    {copied ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy block number</TooltipContent>
                              </Tooltip>
                              {!disconnected && (
                                <Button onClick={() => handleApply(blockNumber)}>
                                  Apply
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                        {blockTimestamp && (
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">Block Timestamp:</span>
                              <span className="text-sm font-mono">{blockTimestamp.unix}</span>
                              <span className="text-sm">=</span>
                              <span className="text-sm">{blockTimestamp.formatted} ({blockTimestamp.timeAgo})</span>
                              <div 
                                ref={blockTimestampRef}
                                className="absolute -left-[9999px] opacity-0 pointer-events-none"
                                style={{ position: 'absolute', left: '-9999px' }}
                              >
                                {blockTimestamp.unix}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleCopy(blockTimestamp.unix.toString(), blockTimestampRef)}
                                  >
                                    {copied ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy timestamp</TooltipContent>
                              </Tooltip>
                              {!disconnected && (
                                <Button onClick={() => handleApply(blockTimestamp.unix.toString())}>
                                  Apply
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        {isLoadingBlock && !blockTimestamp && blockNumber.trim() && (
                          <div className="text-sm text-muted-foreground">
                            Loading block timestamp...
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <DialogFooter className="sm:justify-start">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    {chainMode === "chainId" && selectedChainId && !disconnected && (
                      <Button onClick={() => handleApply(selectedChainId.toString())}>Apply</Button>
                    )}
                  </DialogFooter>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
