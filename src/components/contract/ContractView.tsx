import { useMemo, useState, useEffect, useRef } from "react"
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useContractStore } from "@/stores/contractStore"
import { updateContractLabel, saveContracts } from "@/lib/contractRegistry"
import { copyToClipboard } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Pencil, Network, Copy, ExternalLink, Check } from "lucide-react"
import { FunctionSidebar } from "./FunctionSidebar"
import { SelectedFunctionView } from "./SelectedFunctionView"
import { EditLabelDialog } from "./EditLabelDialog"
import { EditContractAddressModal } from "./EditContractAddressModal"
import { AutoRefreshFunctions } from "./AutoRefreshFunctions"
import { toast } from "sonner"
import type { Address, Abi } from "viem"

interface ContractViewProps {
  contractLabel: string
}

export function ContractView({ contractLabel }: ContractViewProps) {
  const { contracts, selectedAddresses, setSelectedAddress, setContracts, setSelectedFunction, getSelectedFunction, clearReadResultsForContract } = useContractStore()
  const { isConnected, address: walletAddress } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain } = useSwitchChain()
  const [isEditContractLabelOpen, setIsEditContractLabelOpen] = useState(false)
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false)
  const [abis, setAbis] = useState<Record<string, Abi>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const prevAddressRef = useRef<string | null>(null)
  const prevChainIdRef = useRef<number | null>(null)
  const prevWalletAddressRef = useRef<string | null>(null)

  useEffect(() => {
    fetch("/api/abis")
      .then((res) => res.json())
      .then(setAbis)
      .catch(console.error)
  }, [])

  const contract = contracts[contractLabel]
  if (!contract) return null

  const addressIndex = selectedAddresses[contractLabel] ?? 0
  const selectedAddress = contract.addresses[addressIndex]
  const selectedFunction = getSelectedFunction(contractLabel)
  const abi = abis[contract.abi]

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
  }, [selectedAddress?.address, chainId, walletAddress, isConnected, contractLabel, abi, clearReadResultsForContract])

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
          abiFileName={contract.abi}
          selectedFunction={selectedFunction}
          onSelectFunction={(functionName) => setSelectedFunction(contractLabel, functionName)}
        />
      )}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Contract Address:</label>
            <Select
              value={String(addressIndex)}
              onValueChange={(value) =>
                setSelectedAddress(contractLabel, Number(value))
              }
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue>
                  {selectedAddress
                    ? `${selectedAddress.label} (${selectedAddress.address.slice(0, 6)}...${selectedAddress.address.slice(-4)})`
                    : "Select address"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contract.addresses.map((addr, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {addr.label} ({addr.address.slice(0, 6)}...
                    {addr.address.slice(-4)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAddress && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditAddressOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          {selectedAddress && scannerUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
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
          {selectedAddress && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAddress}
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
          )}
        </div>
        {selectedAddress && (
          <SelectedFunctionView
            key={`${contractLabel}-${selectedAddress.address}-${chainId}-${selectedFunction || 'none'}`}
            contractLabel={contractLabel}
            address={selectedAddress.address as Address}
            abi={abi}
            abiFileName={contract.abi}
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
    </div>
  )
}
