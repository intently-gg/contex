import { useState, useMemo } from "react"
import { useChainId } from "wagmi"
import { useContractStore } from "@/stores/contractStore"
import { parseABI } from "@/lib/abiParser"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { safeStringify, formatValueForDisplay, isEmptyValue } from "@/lib/utils"
import type { Address, Abi } from "viem"
import type { ParsedFunction } from "@/lib/abiParser"

interface FunctionSidebarProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiFileName: string
  selectedFunction: string | null
  onSelectFunction: (functionName: string) => void
}

export function FunctionSidebar({
  contractLabel,
  address,
  abi,
  abiFileName: _abiFileName,
  selectedFunction,
  onSelectFunction,
}: FunctionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { isFavorite, getReadResult } = useContractStore()
  const chainId = useChainId()
  
  // Subscribe to favorites to force re-render when they change
  const favorites = useContractStore((state) => state.favorites[contractLabel] || [])

  const allFunctions = useMemo(() => parseABI(abi), [abi])

  const filteredFunctions = useMemo(() => {
    if (!searchQuery) return allFunctions
    const query = searchQuery.toLowerCase()
    return allFunctions.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.inputs.some((input) =>
          (input.name || "").toLowerCase().includes(query)
        )
    )
  }, [allFunctions, searchQuery])

  const pinnedFunctions = useMemo(() => 
    filteredFunctions.filter((f) => isFavorite(contractLabel, f.name)),
    [filteredFunctions, contractLabel, isFavorite, favorites]
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
    
    const result = getReadResult(contractLabel, chainId, func.name, address)
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

  const getFunctionParams = (func: ParsedFunction): string => {
    if (func.inputs.length === 0) return "No parameters"
    return func.inputs
      .map((input) => {
        const name = input.name || "unnamed"
        const type = input.type
        return `${name}: ${type}`
      })
      .join("\n")
  }

  const renderFunctionItem = (func: ParsedFunction) => {
    const isSelected = selectedFunction === func.name
    const result = getFunctionResult(func)
    const params = getFunctionParams(func)

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
                  <span>{func.name}</span>
                  <span style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}> → </span>
                  <span style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}>{result.display}</span>
                </div>
              ) : (
                <div className="text-xs font-medium flex-1 min-w-0" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{func.name}</div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div>
            <div className="font-semibold mb-1">{func.name}</div>
            <pre className="text-xs whitespace-pre-wrap">{params}</pre>
            {result && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-xs font-semibold mb-1">Result:</div>
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {safeStringify(result.full, 2)}
                </pre>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="w-[415px] border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {pinnedFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded">
              Pinned
            </h3>
            <div className="space-y-0.5">
              {pinnedFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredReadFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded">
              Read
            </h3>
            <div className="space-y-0.5">
              {filteredReadFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredWriteFunctions.length > 0 && (
          <div className="p-2">
            <h3 style={{ backgroundColor: 'hsl(var(--muted))' }} className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-2 py-1 rounded">
              Write
            </h3>
            <div className="space-y-0.5">
              {filteredWriteFunctions.map(renderFunctionItem)}
            </div>
          </div>
        )}

        {filteredFunctions.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No functions found
          </div>
        )}
      </div>
    </div>
  )
}
