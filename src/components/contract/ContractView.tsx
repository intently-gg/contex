import { useMemo, useState, useEffect, useRef } from "react"
import { useAccount, useChainId, useChains, useSwitchChain, usePublicClient } from "wagmi"
import { DisclaimerConnectButton } from "@/components/auth/DisclaimerConnectButton"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { copyToClipboard, truncateLabel } from "@/lib/utils"
import { getABILabel } from "@/lib/abiLabels"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Copy, ExternalLink, Check, Plus, Search, Network, AlertCircle } from "lucide-react"
import { FunctionSidebar } from "./FunctionSidebar"
import { SelectedFunctionView } from "./SelectedFunctionView"
import { EditContractAddressModal } from "./EditContractAddressModal"
import { AutoRefreshFunctions } from "./AutoRefreshFunctions"
import { AddContractModal } from "./AddContractModal"
import { ContractSearchModal } from "./ContractSearchModal"
import { toast } from "sonner"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"
import { parseABI } from "@/lib/abiParser"
import type { Address, Abi } from "viem"

interface ContractViewProps {
  abiKey: string
}

export function ContractView({ abiKey }: ContractViewProps) {
  const { contracts, selectedAddresses, setSelectedAddress, setSelectedFunction, getSelectedFunction, clearReadResultsForContract, setSelectedAbiKey } = useContractStore()
  const { abis } = useABIStore()
  const { isConnected, address: walletAddress } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain } = useSwitchChain()
  const publicClient = usePublicClient()
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [noCodeError, setNoCodeError] = useState(false)
  const prevAddressRef = useRef<string | null>(null)
  const prevChainIdRef = useRef<number | null>(null)
  const prevWalletAddressRef = useRef<string | null>(null)

  const addresses = contracts[abiKey] || []
  if (addresses.length === 0) return null

  // Get addressIndex for current contract, ensuring it's valid
  const addressIndex = useMemo(() => {
    const savedIndex = selectedAddresses[abiKey]
    if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < addresses.length) {
      return savedIndex
    }
    return 0
  }, [abiKey, addresses.length, selectedAddresses])
  
  const selectedAddress = addresses[addressIndex]
  const selectedFunction = getSelectedFunction(abiKey)
  
  // Stabilize ABI reference to prevent infinite loops with large ABIs
  const abi = useMemo(() => {
    return abis[abiKey]?.abi as Abi | undefined
  }, [abis, abiKey])

  // Check for ABI parse error
  const abiParseError = useMemo(() => {
    if (!abi) return false
    const parsed = parseABI(abi)
    return parsed === null
  }, [abi])

  // Check for chain compatibility error
  const chainError = useMemo(() => {
    if (!selectedAddress || !isConnected) return false
    return !selectedAddress.chainIds.includes(chainId)
  }, [selectedAddress, chainId, isConnected])

  const enabledChains = useMemo(() => {
    if (!selectedAddress) return []
    return chains.filter((chain) =>
      selectedAddress.chainIds.includes(chain.id)
    )
  }, [selectedAddress, chains])

  const hasError = abiParseError || chainError || noCodeError

  // Auto-refresh read functions with no params when address/chain/wallet changes
  useEffect(() => {
    if (!selectedAddress || !abi || !isConnected || !publicClient) return

    const currentAddress = selectedAddress.address
    const addressChanged = prevAddressRef.current !== currentAddress
    const chainChanged = prevChainIdRef.current !== chainId
    const walletChanged = prevWalletAddressRef.current !== walletAddress
    const isInitialLoad = prevAddressRef.current === null

    // STEP 1: Check if chain is enabled FIRST (before any async calls)
    if (!selectedAddress.chainIds.includes(chainId)) {
      // Chain not enabled, reset code error state and don't proceed with code check
      if (addressChanged || chainChanged || walletChanged || isInitialLoad) {
        setNoCodeError(false)
        // Update refs to track current state
        prevAddressRef.current = currentAddress
        prevChainIdRef.current = chainId
        prevWalletAddressRef.current = walletAddress || null
      }
      return
    }

    if (addressChanged || chainChanged || walletChanged || isInitialLoad) {
      // Reset error state when starting a new check
      setNoCodeError(false)
      
      // STEP 2: Check if contract has deployed code (before any async calls)
      const checkCode = async () => {
        try {
          const code = await publicClient.getBytecode({ address: currentAddress as Address })
          if (!code || code === "0x") {
            setNoCodeError(true)
            return
          }
          setNoCodeError(false)
          
          // STEP 3: Clear ALL cached read results for this contract
          // This erases any cached or currently displayed values
          clearReadResultsForContract(abiKey)
          
          // STEP 4: Trigger refresh for all read functions with no params
          // The refreshKey change will cause those functions to auto-refresh
          setRefreshKey((prev) => (prev === 0 ? 1 : prev + 1))
        } catch (error) {
          console.error('[ContractView] Error checking contract code:', error)
          setNoCodeError(true)
        }
      }
      
      checkCode()
      
      // Update refs to track current state
      prevAddressRef.current = currentAddress
      prevChainIdRef.current = chainId
      prevWalletAddressRef.current = walletAddress || null
    }
  }, [selectedAddress?.address, chainId, walletAddress, isConnected, abiKey, abi, publicClient, selectedAddress?.chainIds])

  const handleUpdateContractABI = async (newAbiKey: string) => {
    // Switching ABI means switching to a different tab (different abiKey)
    if (newAbiKey === abiKey) return
    
    const targetAddresses = contracts[newAbiKey] || []
    if (targetAddresses.length === 0) {
      toast.error("No addresses configured for this ABI")
      return
    }
    
    // Switch to the new ABI tab
    const savedIndex = selectedAddresses[newAbiKey]
    const validIndex = savedIndex !== undefined && savedIndex >= 0 && savedIndex < targetAddresses.length
      ? savedIndex
      : 0
    
    setSelectedAddress(newAbiKey, validIndex)
    setSelectedAbiKey(newAbiKey)
    clearReadResultsForContract(newAbiKey)
    setRefreshKey((prev) => (prev === 0 ? 1 : prev + 1))
    toast.success("Switched to ABI")
  }


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
      <div className="flex h-full min-h-0">
        <div className="flex-1 flex items-center justify-center">
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to interact with contracts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DisclaimerConnectButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }


  if (!abi || !selectedAddress) {
    return (
      <div className="flex h-full min-h-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  // Wallet connected and chain is enabled - show full interface with sidebar
  return (
    <div className="flex flex-1 min-h-0">
      {/* Hidden component that renders all ReadFunction components for functions with no params */}
      {/* This ensures they all receive refreshKey and can auto-refresh */}
      {/* Key includes address to force remount when address changes */}
      {selectedAddress && abi && !hasError && (
        <AutoRefreshFunctions
          key={`${abiKey}-${selectedAddress.address}-${chainId}`}
          abiKey={abiKey}
          address={selectedAddress.address as Address}
          abi={abi}
          refreshKey={refreshKey}
        />
      )}
      {selectedAddress && !hasError && (
        <FunctionSidebar
          abiKey={abiKey}
          address={selectedAddress.address as Address}
          abi={abi}
          selectedFunction={selectedFunction}
          onSelectFunction={(functionName) => setSelectedFunction(abiKey, functionName)}
        />
      )}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <label className="text-sm font-medium">ABI:</label>
            <Select
              value={abiKey}
              onValueChange={handleUpdateContractABI}
            >
              <SelectTrigger style={{ width: '200px', maxWidth: '200px' }}>
                <SelectValue>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate block">
                        {truncateLabel(getABILabel(abis, abiKey)).display}
                      </span>
                    </TooltipTrigger>
                    {(() => {
                      const abiLabel = getABILabel(abis, abiKey)
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
                {Object.keys(abis).map((key) => {
                  const abiLabel = getABILabel(abis, key)
                  const truncated = truncateLabel(abiLabel)
                  return (
                    <SelectItem key={key} value={key}>
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
              key={`contract-select-${abiKey}`}
              value={addresses.length > 0 ? String(addressIndex) : undefined}
              onValueChange={(value) =>
                setSelectedAddress(abiKey, Number(value))
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
                                onError={(e) => {
                                  e.preventDefault()
                                  const target = e.target as HTMLImageElement
                                  if (target.src !== DEFAULT_CHAIN_ICON) {
                                    target.src = DEFAULT_CHAIN_ICON
                                  }
                                }}
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
                {addresses.map((addr, idx) => {
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
                                onError={(e) => {
                                  e.preventDefault()
                                  const target = e.target as HTMLImageElement
                                  if (target.src !== DEFAULT_CHAIN_ICON) {
                                    target.src = DEFAULT_CHAIN_ICON
                                  }
                                }}
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
        {hasError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                {abiParseError ? (
                  <>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#ec4899' }}>
                      <AlertCircle className="h-5 w-5" />
                      Could not parse this ABI
                    </CardTitle>
                    <CardDescription>
                      The ABI for this contract could not be parsed. Please select a different ABI or contract.
                    </CardDescription>
                  </>
                ) : noCodeError ? (
                  <>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#ec4899' }}>
                      <AlertCircle className="h-5 w-5" />
                      No Contract Code Deployed
                    </CardTitle>
                    <CardDescription>
                      There does not appear to be any smart contract code deployed on this chain to this address. Please double-check your configuration.
                    </CardDescription>
                  </>
                ) : chainError ? (
                  <>
                    <CardTitle>Switch to Enabled Chain</CardTitle>
                    <CardDescription>
                      This contract is not enabled on the currently connected chain.
                      Please switch to one of the enabled chains below, or pick another ABI/Contract.
                    </CardDescription>
                  </>
                ) : null}
              </CardHeader>
              {chainError && !abiParseError && !noCodeError && enabledChains.length > 0 && (
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
                              onError={(e) => {
                                e.preventDefault()
                                const target = e.target as HTMLImageElement
                                if (target.src !== DEFAULT_CHAIN_ICON) {
                                  target.src = DEFAULT_CHAIN_ICON
                                }
                              }}
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
              )}
            </Card>
          </div>
        ) : selectedAddress ? (
          <SelectedFunctionView
            key={`${abiKey}-${selectedAddress.address}-${chainId}-${selectedFunction || 'none'}`}
            abiKey={abiKey}
            address={selectedAddress.address as Address}
            abi={abi}
            functionName={selectedFunction}
            supportedChainIds={selectedAddress.chainIds}
            refreshKey={refreshKey}
          />
        ) : null}
      </div>

      {selectedAddress && (
        <EditContractAddressModal
          open={isEditAddressOpen}
          onOpenChange={setIsEditAddressOpen}
          abiKey={abiKey}
          address={selectedAddress.address}
        />
      )}
      <AddContractModal
        open={isAddContractOpen}
        onOpenChange={setIsAddContractOpen}
        defaultAbiKey={abiKey}
      />
      <ContractSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
      />
    </div>
  )
}
