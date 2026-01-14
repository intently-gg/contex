import { useState, useMemo } from "react"
import { useChainId } from "wagmi"
import { useContractStore } from "@/stores/contractStore"
import { parseABI } from "@/lib/abiParser"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Pin, Eye, Pencil, Signature } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { safeStringify, formatValueForDisplay, isEmptyValue, getFunctionSignature } from "@/lib/utils"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"

const EMPTY_FAVORITES_ARRAY: string[] = []

interface FunctionSidebarProps {
  abiKey: string
  address: Address
  abi: Abi
  selectedFunction: string | null
  onSelectFunction: (functionName: string) => void
}

export function FunctionSidebar({
  abiKey,
  address,
  abi,
  selectedFunction,
  onSelectFunction,
}: FunctionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showSignaturesInNavbar, setShowSignaturesInNavbar] = useState(false)
  const { isFavorite, getReadResult } = useContractStore()
  const chainId = useChainId()
  
  // Subscribe to favorites to force re-render when they change
  // Selector returns the actual array (or undefined), then useMemo provides stable empty array
  const favoritesArray = useContractStore((state) => state.favorites[abiKey])
  const favorites = useMemo(() => favoritesArray ?? EMPTY_FAVORITES_ARRAY, [favoritesArray])

  const parseError = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed === null
  }, [abi])
  
  const allFunctions = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed || []
  }, [abi])

  const filteredFunctions = useMemo(() => {
    if (!searchQuery) return allFunctions
    const query = searchQuery.toLowerCase()
    return allFunctions.filter(
      (f) => {
        const nameMatch = f.name.toLowerCase().includes(query)
        const inputMatch = f.inputs.some((input) =>
          (input.name || "").toLowerCase().includes(query)
        )
        const signature = getFunctionSignature(f.abiFunction)
        const signatureMatch = signature.toLowerCase().includes(query)
        return nameMatch || inputMatch || signatureMatch
      }
    )
  }, [allFunctions, searchQuery])

  const pinnedFunctions = useMemo(() => 
    filteredFunctions.filter((f) => isFavorite(abiKey, f.name)),
    [filteredFunctions, abiKey, isFavorite, favorites]
  )

  const filteredReadFunctions = useMemo(() => 
    filteredFunctions.filter((f) => f.type === "read"),
    [filteredFunctions]
  )

  const filteredWriteFunctions = useMemo(() => 
    filteredFunctions.filter((f) => f.type === "write"),
    [filteredFunctions]
  )

  const getFunctionResult = (func: ParsedFunction): { display: string; full: unknown } | null => {
    if (func.type !== "read") return null
    // Only show values for functions with NO input parameters
    if (func.inputs.length > 0) return null
    
    const result = getReadResult(abiKey, chainId, func.name, address)
    if (!result || result.value === undefined) return null
    
    // Check if value is empty (only for navbar display)
    if (isEmptyValue(result.value)) {
      return null
    }
    
    try {
      const display = formatValueForDisplay(result.value)
      return { display, full: result.value }
    } catch {
      return null
    }
  }

  const renderFunctionItem = (func: ParsedFunction) => {
    const isSelected = selectedFunction === func.name
    const result = getFunctionResult(func)
    const signature = getFunctionSignature(func.abiFunction)

    return (
      <Tooltip key={func.name}>
        <TooltipTrigger asChild>
          <div
            style={{
              backgroundColor: isSelected ? 'hsl(var(--primary))' : 'transparent',
              color: isSelected ? 'hsl(var(--primary-foreground))' : 'inherit',
              boxShadow: isSelected ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none',
              transition: 'all 150ms',
            }}
            className="flex items-center justify-between p-1.5 rounded-md cursor-pointer"
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
            onClick={() => onSelectFunction(func.name)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0" style={{ overflow: 'hidden' }}>
              {result ? (
                <div className="text-xs font-medium flex-1 min-w-0" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {showSignaturesInNavbar && signature && (
                    <span className="text-muted-foreground">{signature} </span>
                  )}
                  <span>{func.name}</span>
                  <span style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}> → </span>
                  <span style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}>{result.display}</span>
                </div>
              ) : (
                <div className="text-xs font-medium flex-1 min-w-0" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {showSignaturesInNavbar && signature && (
                    <span className="text-muted-foreground">{signature} </span>
                  )}
                  {func.name}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        {result && (
          <TooltipContent className="max-h-[75px] overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {safeStringify(result.full, 2)}
            </pre>
          </TooltipContent>
        )}
      </Tooltip>
    )
  }

  return (
    <div className="w-[415px] border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search functions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showSignaturesInNavbar ? "default" : "outline"}
                size="icon"
                onClick={() => setShowSignaturesInNavbar(!showSignaturesInNavbar)}
                className="h-10 w-10"
              >
                <Signature className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showSignaturesInNavbar ? "Hide function signatures" : "Show function signatures"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {pinnedFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded flex items-center gap-2">
              <Pin className="h-3 w-3" />
              Pinned Functions
            </h3>
            <div className="space-y-0.5">
              {pinnedFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredReadFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded flex items-center gap-2">
              <Eye className="h-3 w-3" />
              Read Functions
            </h3>
            <div className="space-y-0.5">
              {filteredReadFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredWriteFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded flex items-center gap-2">
              <Pencil className="h-3 w-3" />
              Write Functions
            </h3>
            <div className="space-y-0.5">
              {filteredWriteFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredFunctions.length === 0 && !parseError && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No functions found
          </div>
        )}
      </div>
    </div>
  )
}
