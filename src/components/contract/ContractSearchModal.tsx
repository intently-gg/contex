import { useState, useMemo } from "react"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { useChains } from "wagmi"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, FileCode, Scroll } from "lucide-react"
import { getABILabel } from "@/lib/abiLabels"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"
import { truncateLabel } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Address } from "viem"

interface ContractSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContractSearchModal({ open, onOpenChange }: ContractSearchModalProps) {
  const { contracts, setSelectedAbiKey, setSelectedAddress } = useContractStore()
  const { abis } = useABIStore()
  const chains = useChains()
  const [searchQuery, setSearchQuery] = useState("")

  // Filter based on search query
  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts
    
    const query = searchQuery.toLowerCase()
    const filtered: typeof contracts = {}
    
    for (const [abiKey, addresses] of Object.entries(contracts)) {
      const abiLabel = getABILabel(abis, abiKey)
      const abiMatches = abiLabel.toLowerCase().includes(query)
      
      const filteredAddresses = addresses.filter((addr) => {
        const labelMatches = addr.label.toLowerCase().includes(query)
        const addressMatches = addr.address.toLowerCase().includes(query)
        return labelMatches || addressMatches
      })
      
      // Include ABI if it matches or has matching addresses
      if (abiMatches || filteredAddresses.length > 0) {
        filtered[abiKey] = abiMatches ? addresses : filteredAddresses
      }
    }
    
    return filtered
  }, [contracts, abis, searchQuery])

  const handleSelectContract = (abiKey: string, addressIndex: number) => {
    setSelectedAbiKey(abiKey)
    setSelectedAddress(abiKey, addressIndex)
    onOpenChange(false)
    setSearchQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Contracts</DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ABI name, contract label, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md p-4">
          {Object.keys(filteredContracts).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "No contracts found matching your search" : "No contracts available"}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(filteredContracts).map(([abiKey, addresses]) => {
                const abiLabel = getABILabel(abis, abiKey)
                const truncatedAbiLabel = truncateLabel(abiLabel)
                
                return (
                  <div key={abiKey} className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-semibold text-sm truncate">{truncatedAbiLabel.display}</span>
                        </TooltipTrigger>
                        {truncatedAbiLabel.display !== truncatedAbiLabel.full ? (
                          <TooltipContent>
                            <p>{truncatedAbiLabel.full}</p>
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    </div>
                    
                    <div className="ml-4 space-y-1">
                      {addresses.map((addr, index) => {
                        const addrChains = chains.filter((chain) => 
                          addr.chainIds.includes(chain.id)
                        )
                        
                        return (
                          <div
                            key={`${abiKey}-${index}`}
                            onClick={() => handleSelectContract(abiKey, index)}
                            className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Scroll className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-sm font-medium truncate">
                                      {(() => {
                                        const truncated = truncateLabel(addr.label)
                                        const labelText = `${addr.label} (${addr.address.slice(0, 6)}...${addr.address.slice(-4)})`
                                        return truncated.display !== truncated.full
                                          ? `${truncated.display} (${addr.address.slice(0, 6)}...${addr.address.slice(-4)})`
                                          : labelText
                                      })()}
                                    </div>
                                  </TooltipTrigger>
                                  {(() => {
                                    const truncated = truncateLabel(addr.label)
                                    return truncated.display !== truncated.full ? (
                                      <TooltipContent>
                                        <p>{addr.label}</p>
                                      </TooltipContent>
                                    ) : null
                                  })()}
                                </Tooltip>
                                <div className="text-xs text-muted-foreground truncate">
                                  {addr.address}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              {addrChains.map((chain, idx) => {
                                const iconUrl = (chain as any).iconUrl || ((chain.nativeCurrency as any)?.iconUrl)
                                const iconBackground = (chain as any).iconBackground || '#d3d3d3'
                                return (
                                  <img
                                    key={chain.id}
                                    src={iconUrl || DEFAULT_CHAIN_ICON}
                                    alt={chain.name}
                                    className="w-4 h-4 rounded-full"
                                    title={chain.name}
                                    onError={(e) => {
                                      e.preventDefault()
                                      const target = e.target as HTMLImageElement
                                      if (target.src !== DEFAULT_CHAIN_ICON) {
                                        target.src = DEFAULT_CHAIN_ICON
                                      }
                                    }}
                                    style={{
                                      marginLeft: idx > 0 ? '-8px' : '0',
                                      zIndex: addrChains.length - idx,
                                      backgroundColor: iconBackground,
                                    }}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

