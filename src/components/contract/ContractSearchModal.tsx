import { useState, useMemo } from "react"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { useChains } from "wagmi"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, FileCode, Scroll } from "lucide-react"
import { getABILabel } from "@/lib/abiLabels"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"
import type { Address } from "viem"

interface ContractSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContractSearchModal({ open, onOpenChange }: ContractSearchModalProps) {
  const { contracts, setSelectedContract, setSelectedAddress } = useContractStore()
  const { abis, abiLabels } = useABIStore()
  const chains = useChains()
  const [searchQuery, setSearchQuery] = useState("")

  // Build a structure: ABI -> Contracts (addresses)
  const abiContractMap = useMemo(() => {
    const map: Record<string, Array<{ contractLabel: string; addressIndex: number; address: Address; label: string; chainIds: number[] }>> = {}
    
    for (const [contractLabel, contract] of Object.entries(contracts)) {
      const abiKey = contract.abi
      if (!map[abiKey]) {
        map[abiKey] = []
      }
      
      contract.addresses.forEach((addr, index) => {
        map[abiKey].push({
          contractLabel,
          addressIndex: index,
          address: addr.address,
          label: addr.label,
          chainIds: addr.chainIds,
        })
      })
    }
    
    return map
  }, [contracts])

  // Filter based on search query
  const filteredAbiContractMap = useMemo(() => {
    if (!searchQuery.trim()) return abiContractMap
    
    const query = searchQuery.toLowerCase()
    const filtered: typeof abiContractMap = {}
    
    for (const [abiKey, contractList] of Object.entries(abiContractMap)) {
      const abiLabel = getABILabel(abiLabels, abiKey)
      const abiMatches = abiLabel.toLowerCase().includes(query)
      
      const filteredContracts = contractList.filter((contract) => {
        const labelMatches = contract.contractLabel.toLowerCase().includes(query)
        const addressMatches = contract.address.toLowerCase().includes(query)
        return labelMatches || addressMatches
      })
      
      // Include ABI if it matches or has matching contracts
      if (abiMatches || filteredContracts.length > 0) {
        filtered[abiKey] = abiMatches ? contractList : filteredContracts
      }
    }
    
    return filtered
  }, [abiContractMap, abiLabels, searchQuery])

  const handleSelectContract = (contractLabel: string, addressIndex: number) => {
    setSelectedContract(contractLabel)
    setSelectedAddress(contractLabel, addressIndex)
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
          {Object.keys(filteredAbiContractMap).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "No contracts found matching your search" : "No contracts available"}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(filteredAbiContractMap).map(([abiKey, contractList]) => {
                const abiLabel = getABILabel(abiLabels, abiKey)
                
                return (
                  <div key={abiKey} className="space-y-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{abiLabel}</span>
                    </div>
                    
                    <div className="ml-4 space-y-1">
                      {contractList.map((contract) => {
                        const addrChains = chains.filter((chain) => 
                          contract.chainIds.includes(chain.id)
                        )
                        
                        return (
                          <div
                            key={`${contract.contractLabel}-${contract.addressIndex}`}
                            onClick={() => handleSelectContract(contract.contractLabel, contract.addressIndex)}
                            className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Scroll className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {contract.label} ({contract.address.slice(0, 6)}...{contract.address.slice(-4)})
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {contract.address}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              {addrChains.map((chain, index) => {
                                const iconUrl = (chain as any).iconUrl || ((chain.nativeCurrency as any)?.iconUrl)
                                const iconBackground = (chain as any).iconBackground || '#d3d3d3'
                                return (
                                  <img
                                    key={chain.id}
                                    src={iconUrl || DEFAULT_CHAIN_ICON}
                                    alt={chain.name}
                                    className="w-4 h-4 rounded-full"
                                    title={chain.name}
                                    style={{
                                      marginLeft: index > 0 ? '-8px' : '0',
                                      zIndex: addrChains.length - index,
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

