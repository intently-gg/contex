import { useMemo, useState, useEffect, useRef } from "react"
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { updateContractLabel, updateContractABI, saveContracts } from "@/lib/contractRegistry"
import { copyToClipboard, truncateLabel } from "@/lib/utils"
import { getABILabel } from "@/lib/abiLabels"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Network, Copy, ExternalLink, Check, Plus, Search } from "lucide-react"
import { FunctionSidebar } from "./FunctionSidebar"
import { SelectedFunctionView } from "./SelectedFunctionView"
import { EditLabelDialog } from "./EditLabelDialog"
import { EditContractAddressModal } from "./EditContractAddressModal"
import { AutoRefreshFunctions } from "./AutoRefreshFunctions"
import { AddContractModal } from "./AddContractModal"
import { ContractSearchModal } from "./ContractSearchModal"
import { toast } from "sonner"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"
import type { Address, Abi } from "viem"

interface ContractViewProps {
  contractLabel: string
}

export function ContractView({ contractLabel }: ContractViewProps) {
  const { contracts, selectedAddresses, setSelectedAddress, setContracts, setSelectedFunction, getSelectedFunction, clearReadResultsForContract } = useContractStore()
  const { abis, abiLabels } = useABIStore()
  const { isConnected, address: walletAddress } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain } = useSwitchChain()
  const [isEditContractLabelOpen, setIsEditContractLabelOpen] = useState(false)
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const prevAddressRef = useRef<string | null>(null)
  const prevChainIdRef = useRef<number | null>(null)
  const prevWalletAddressRef = useRef<string | null>(null)

  const contract = contracts[contractLabel]
  if (!contract) return null

  const addressIndex = selectedAddresses[contractLabel] ?? 0
  const selectedAddress = contract.addresses[addressIndex]
  const selectedFunction = getSelectedFunction(contractLabel)
  
  // Stabilize ABI reference to prevent infinite loops with large ABIs
  const abi = useMemo(() => abis[contract.abi] as Abi | undefined, [abis, contract.abi])

  // Auto-refresh read functions with no params when address/chain/wallet changes
  useEffect(() => {
    if (!selectedAddress || !abi || !isConnected) return

    const currentAddress = selectedAddress.address
    const addressChanged = prevAddressRef.current !== currentAddress
    const chainChanged = prevChainIdRef.current !== chainId
    const walletChanged = prevWalletAddressRef.current !== walletAddress
    const isInitialLoad = prevAddressRef.current === null

    if (addressChanged || chainChanged || walletChanged || isInitialLoad) {
      // STEP 1: Clear ALL cached read results for this contract FIRST
      // This erases any cached or currently displayed values
      console.debug('[ContractView] Attempting to clear cache after repointing to new contract', {
        contractLabel,
        addressChanged,
        chainChanged,
        walletChanged,
        isInitialLoad,
        currentAddress,
        prevAddress: prevAddressRef.current,
        chainId,
        prevChainId: prevChainIdRef.current,
        walletAddress,
        prevWalletAddress: prevWalletAddressRef.current,
      })
      clearReadResultsForContract(contractLabel)
      
      // STEP 2: Trigger refresh for all read functions with no params
      // The refreshKey change will cause those functions to auto-refresh
      setRefreshKey((prev) => (prev === 0 ? 1 : prev + 1))
      
      // Update refs to track current state
      prevAddressRef.current = currentAddress
      prevChainIdRef.current = chainId
      prevWalletAddressRef.current = walletAddress || null
    }
  }, [selectedAddress?.address, chainId, walletAddress, isConnected, contractLabel, abi])

  const handleUpdateContractLabel = async (newLabel: string) => {
    try {
      const updated = updateContractLabel(contracts, contractLabel, newLabel)
      await saveContracts(updated)
      setContracts(updated)
      toast.success("Contract label updated")
    } catch (error) {
      toast.error("Failed to update contract label")
    }
  }

  const handleUpdateContractABI = async (newAbiKey: string) => {
    try {
      const updated = updateContractABI(contracts, contractLabel, newAbiKey)
      await saveContracts(updated)
      setContracts(updated)
      clearReadResultsForContract(contractLabel)
      setRefreshKey((prev) => (prev === 0 ? 1 : prev + 1))
      toast.success("Contract ABI updated")
    } catch (error) {
      toast.error("Failed to update contract ABI")
    }
  }


  const enabledChains = useMemo(() => {
    if (!selectedAddress) return []
    return chains.filter((chain) =>
      selectedAddress.chainIds.includes(chain.id)
    )
  }, [selectedAddress, chains])

  const isCurrentChainEnabled = selectedAddress
    ? selectedAddress.chainIds.includes(chainId)
    : false

  const scannerUrl = useMemo(() => {
    if (!selectedAddress) return null
    const currentChain = chains.find((c) => c.id === chainId && selectedAddress.chainIds.includes(c.id))
    const chain = currentChain || chains.find((c) => selectedAddress.chainIds.includes(c.id))
    if (!chain?.blockExplorers?.default?.url) return null
    return `${chain.blockExplorers.default.url}/address/${selectedAddress.address}`
  }, [selectedAddress, chainId, chains])

  const handleCopyAddress = async () => {
    if (!selectedAddress) return
    const success = await copyToClipboard(selectedAddress.address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Check wallet connection first
  if (!isConnected) {
    return (
      <div className="flex h-[calc(100vh-200px)]">
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to interact with contracts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Check chain compatibility
  if (!isCurrentChainEnabled && selectedAddress) {
    return (
      <div className="flex h-[calc(100vh-200px)]">
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardHeader>
              <CardTitle>Switch to Enabled Chain</CardTitle>
              <CardDescription>
                This contract is not enabled on the currently connected chain.
                Please switch to one of the enabled chains below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-center gap-2">
                {enabledChains.map((chain) => {
                  const iconUrl = (chain as any).iconUrl || ((chain.nativeCurrency as any)?.iconUrl)
                  return (
                    <Button
                      key={chain.id}
                      variant="outline"
                      onClick={() => {
                        try {
                          switchChain({ chainId: chain.id })
                        } catch (error) {
                          toast.error("Failed to switch chain", {
                            description: error instanceof Error ? error.message : "Unknown error",
                          })
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={chain.name}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <Network className="h-4 w-4" />
                      )}
                      {chain.name}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!abi || !selectedAddress) {
    return (
      <div className="flex h-[calc(100vh-200px)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  // Wallet connected and chain is enabled - show full interface with sidebar
  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Hidden component that renders all ReadFunction components for functions with no params */}
      {/* This ensures they all receive refreshKey and can auto-refresh */}
      {/* Key includes address to force remount when address changes */}
      {selectedAddress && abi && (
        <AutoRefreshFunctions
          key={`${contractLabel}-${selectedAddress.address}-${chainId}`}
          contractLabel={contractLabel}
          address={selectedAddress.address as Address}
          abi={abi}
          refreshKey={refreshKey}
        />
      )}
      {selectedAddress && (
        <FunctionSidebar
          contractLabel={contractLabel}
          address={selectedAddress.address as Address}
          abi={abi}
          abiKey={contract.abi}
          selectedFunction={selectedFunction}
          onSelectFunction={(functionName) => setSelectedFunction(contractLabel, functionName)}
        />
      )}
      <div className="flex-1 flex flex-col" style={{ maxWidth: '1125px' }}>
        <div className="p-4 border-b flex items-center gap-4">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <label className="text-sm font-medium">ABI:</label>
            <Select
              value={contract.abi}
              onValueChange={handleUpdateContractABI}
            >
              <SelectTrigger style={{ width: '200px', maxWidth: '200px' }}>
                <SelectValue>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate block">
                        {truncateLabel(getABILabel(abiLabels, contract.abi)).display}
                      </span>
                    </TooltipTrigger>
                    {(() => {
                      const abiLabel = getABILabel(abiLabels, contract.abi)
                      const truncated = truncateLabel(abiLabel)
                      return truncated.display !== truncated.full ? (
                        <TooltipContent>
                          <p>{truncated.full}</p>
                        </TooltipContent>
                      ) : null
                    })()}
                  </Tooltip>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.keys(abis).map((abiKey) => {
                  const abiLabel = getABILabel(abiLabels, abiKey)
                  const truncated = truncateLabel(abiLabel)
                  return (
                    <SelectItem key={abiKey} value={abiKey}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block">
                            {truncated.display}
                          </span>
                        </TooltipTrigger>
                        {truncated.display !== truncated.full ? (
                          <TooltipContent>
                            <p>{truncated.full}</p>
                          </TooltipContent>
                        ) : null}
                      </Tooltip>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <label className="text-sm font-medium pl-2">Contract:</label>
            <Select
              value={String(addressIndex)}
              onValueChange={(value) =>
                setSelectedAddress(contractLabel, Number(value))
              }
            >
              <SelectTrigger className="flex-1" style={{ maxWidth: '500px' }}>
                <SelectValue>
                  {selectedAddress ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 min-w-0 truncate">
                            {(() => {
                              const labelText = `${selectedAddress.label} (${selectedAddress.address.slice(0, 6)}...${selectedAddress.address.slice(-4)})`
                              const truncated = truncateLabel(selectedAddress.label)
                              return truncated.display !== truncated.full 
                                ? `${truncated.display} (${selectedAddress.address.slice(0, 6)}...${selectedAddress.address.slice(-4)})`
                                : labelText
                            })()}
                          </span>
                        </TooltipTrigger>
                        {(() => {
                          const truncated = truncateLabel(selectedAddress.label)
                          return truncated.display !== truncated.full ? (
                            <TooltipContent>
                              <p>{selectedAddress.label}</p>
                            </TooltipContent>
                          ) : null
                        })()}
                      </Tooltip>
                      <div className="flex items-center flex-shrink-0" style={{ marginLeft: '4px' }}>
                        {chains
                          .filter((chain) => selectedAddress.chainIds.includes(chain.id))
                          .map((chain, index) => {
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
                                  zIndex: chains.filter((c) => selectedAddress.chainIds.includes(c.id)).length - index,
                                  backgroundColor: iconBackground,
                                }}
                              />
                            )
                          })}
                      </div>
                    </div>
                  ) : (
                    "Select address"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contract.addresses.map((addr, idx) => {
                  const addrChains = chains.filter((chain) => addr.chainIds.includes(chain.id))
                  const truncated = truncateLabel(addr.label)
                  return (
                    <SelectItem key={idx} value={String(idx)}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-1 min-w-0 truncate">
                              {truncated.display !== truncated.full
                                ? `${truncated.display} (${addr.address.slice(0, 6)}...${addr.address.slice(-4)})`
                                : `${addr.label} (${addr.address.slice(0, 6)}...${addr.address.slice(-4)})`}
                            </span>
                          </TooltipTrigger>
                          {truncated.display !== truncated.full ? (
                            <TooltipContent>
                              <p>{addr.label}</p>
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                        <div className="flex items-center flex-shrink-0" style={{ marginLeft: '4px' }}>
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
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {selectedAddress && (
              <div className="flex items-center" style={{ gap: '4px' }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchModalOpen(true)}
                  style={{
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditAddressOpen(true)}
                  style={{
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAddContractOpen(true)}
                  style={{
                    transition: 'all 0.2s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {scannerUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        style={{
                          transition: 'all 0.2s ease-in-out',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)'
                          e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <a
                          href={scannerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open in block explorer</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyAddress}
                      style={{
                        transition: 'all 0.2s ease-in-out',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)'
                        e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy address</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
        {selectedAddress && (
          <SelectedFunctionView
            key={`${contractLabel}-${selectedAddress.address}-${chainId}-${selectedFunction || 'none'}`}
            contractLabel={contractLabel}
            address={selectedAddress.address as Address}
            abi={abi}
            abiKey={contract.abi}
            functionName={selectedFunction}
            supportedChainIds={selectedAddress.chainIds}
            refreshKey={refreshKey}
          />
        )}
      </div>

      <EditLabelDialog
        open={isEditContractLabelOpen}
        onOpenChange={setIsEditContractLabelOpen}
        currentLabel={contractLabel}
        onSave={handleUpdateContractLabel}
        title="Edit Contract Label"
        description="Update the label for this contract"
      />
      {selectedAddress && (
        <EditContractAddressModal
          open={isEditAddressOpen}
          onOpenChange={setIsEditAddressOpen}
          contractLabel={contractLabel}
          addressIndex={addressIndex}
        />
      )}
      <AddContractModal
        open={isAddContractOpen}
        onOpenChange={setIsAddContractOpen}
        defaultAbiKey={contract.abi}
      />
      <ContractSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
      />
    </div>
  )
}
