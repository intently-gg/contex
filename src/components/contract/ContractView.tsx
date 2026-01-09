import { useMemo, useState, useEffect } from "react"
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useContractStore } from "@/stores/contractStore"
import { updateContractLabel, updateAddressLabel, saveContracts } from "@/lib/contractRegistry"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Network } from "lucide-react"
import { FunctionSidebar } from "./FunctionSidebar"
import { SelectedFunctionView } from "./SelectedFunctionView"
import { EditLabelDialog } from "./EditLabelDialog"
import { toast } from "sonner"
import type { Address, Abi } from "viem"

interface ContractViewProps {
  contractLabel: string
}

export function ContractView({ contractLabel }: ContractViewProps) {
  const { contracts, selectedAddresses, setSelectedAddress, setContracts, setSelectedFunction, getSelectedFunction } = useContractStore()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain } = useSwitchChain()
  const [isEditContractLabelOpen, setIsEditContractLabelOpen] = useState(false)
  const [isEditAddressLabelOpen, setIsEditAddressLabelOpen] = useState(false)
  const [abis, setAbis] = useState<Record<string, Abi>>({})

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

  const handleUpdateAddressLabel = async (newLabel: string) => {
    try {
      const updated = updateAddressLabel(contracts, contractLabel, addressIndex, newLabel)
      await saveContracts(updated)
      setContracts(updated)
      toast.success("Address label updated")
    } catch (error) {
      toast.error("Failed to update address label")
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
                onClick={() => setIsEditAddressLabelOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {selectedAddress && (
          <SelectedFunctionView
            contractLabel={contractLabel}
            address={selectedAddress.address as Address}
            abi={abi}
            abiFileName={contract.abi}
            functionName={selectedFunction}
            supportedChainIds={selectedAddress.chainIds}
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
        <EditLabelDialog
          open={isEditAddressLabelOpen}
          onOpenChange={setIsEditAddressLabelOpen}
          currentLabel={selectedAddress.label}
          onSave={handleUpdateAddressLabel}
          title="Edit Address Label"
          description="Update the label for this address"
        />
      )}
    </div>
  )
}
