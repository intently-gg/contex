import { useMemo } from "react"
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useContractStore } from "@/stores/contractStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Network, ArrowRight } from "lucide-react"
import { ReadFunction } from "./ReadFunction"
import { WriteFunction } from "./WriteFunction"
import { parseABI } from "@/lib/abiParser"
import { toast } from "sonner"
import type { Address, Abi } from "viem"

interface SelectedFunctionViewProps {
  contractLabel: string
  address: Address
  abi: Abi
  abiKey: string
  functionName: string | null
  supportedChainIds: number[]
  refreshKey?: number
  onBack?: () => void
}

export function SelectedFunctionView({
  contractLabel,
  address,
  abi,
  abiKey,
  functionName,
  supportedChainIds,
  refreshKey,
  onBack: _onBack,
}: SelectedFunctionViewProps) {
  const { contracts, selectedAddresses } = useContractStore()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain } = useSwitchChain()

  const contract = contracts[contractLabel]
  if (!contract) return null

  const addressIndex = selectedAddresses[contractLabel] ?? 0
  const selectedAddress = contract.addresses[addressIndex]

  const allFunctions = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed || []
  }, [abi])
  
  const parseError = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed === null
  }, [abi])
  
  const selectedFunc = useMemo(() => 
    allFunctions.find((f) => f.name === functionName),
    [allFunctions, functionName]
  )

  const enabledChains = useMemo(() => {
    if (!selectedAddress) return []
    return chains.filter((chain) =>
      selectedAddress.chainIds.includes(chain.id)
    )
  }, [selectedAddress, chains])

  const isCurrentChainEnabled = selectedAddress
    ? selectedAddress.chainIds.includes(chainId)
    : false


  if (!isConnected) {
    return (
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
    )
  }

  if (!isCurrentChainEnabled && selectedAddress) {
    return (
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
    )
  }

  if (parseError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <span className="text-lg">Could not parse this ABI</span>
        </div>
      </div>
    )
  }

  if (!functionName || !selectedFunc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ transform: "scaleX(-1)" }} />
          <span className="text-lg">Select a function to get started.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: '1125px' }}>
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFunc.type === "read" ? (
          <ReadFunction
            contractLabel={contractLabel}
            address={address}
            abi={abi}
            abiKey={abiKey}
            function={selectedFunc}
            supportedChainIds={supportedChainIds}
            refreshKey={refreshKey}
          />
        ) : (
          <WriteFunction
            contractLabel={contractLabel}
            address={address}
            abi={abi}
            abiKey={abiKey}
            function={selectedFunc}
            supportedChainIds={supportedChainIds}
          />
        )}
      </div>

    </div>
  )
}

