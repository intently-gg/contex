import { useState, useEffect } from "react"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { addContract, saveContracts } from "@/lib/contractRegistry"
import { getABILabel } from "@/lib/abiLabels"
import { truncateLabel } from "@/lib/utils"
import { config } from "@/lib/wagmi"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, ChevronRight, ChevronLeft, Plus } from "lucide-react"
import type { Address } from "viem"
import { isAddress, getAddress } from "viem"
import { AddABIModal } from "./AddABIModal"

interface AddContractModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAbiKey?: string
}

type Step = "select-abi" | "contract-details"

export function AddContractModal({
  open,
  onOpenChange,
  defaultAbiKey,
}: AddContractModalProps) {
  const { contracts, setContracts } = useContractStore()
  const { abis, abiLabels } = useABIStore()
  const [step, setStep] = useState<Step>("select-abi")
  const [abiKey, setAbiKey] = useState("")
  const [address, setAddress] = useState("")
  const [addressLabel, setAddressLabel] = useState("")
  const [chainIds, setChainIds] = useState<number[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isAddABIOpen, setIsAddABIOpen] = useState(false)

  useEffect(() => {
    if (open) {
      const abiKeys = Object.keys(abis)
      // If defaultAbiKey is provided and exists, use it and skip to contract-details
      if (defaultAbiKey && abiKeys.includes(defaultAbiKey)) {
        setAbiKey(defaultAbiKey)
        setStep("contract-details")
      } else {
        setStep("select-abi")
        // If there's only one ABI, preselect it
        setAbiKey(abiKeys.length === 1 ? abiKeys[0] : "")
      }
      setAddress("")
      setAddressLabel("")
      setChainIds([])
    }
  }, [open, abis, defaultAbiKey])

  const availableChains = config.chains

  const handleABISelected = () => {
    if (!abiKey) {
      toast.error("Please select an ABI")
      return
    }
    setStep("contract-details")
  }

  const handleAddressChange = (value: string) => {
    // Only allow hex characters (0-9, a-f, A-F) and ensure it starts with 0x
    let cleaned = value.trim()
    
    // Remove any non-hex characters
    cleaned = cleaned.replace(/[^0-9a-fA-Fx]/g, "")
    
    // Ensure it starts with 0x
    if (cleaned && !cleaned.startsWith("0x")) {
      cleaned = "0x" + cleaned.replace(/^0x/, "")
    }
    
    // Limit to 42 characters (0x + 40 hex chars)
    if (cleaned.length > 42) {
      cleaned = cleaned.slice(0, 42)
    }
    
    setAddress(cleaned)
    
    // Auto-populate address label if empty and address is valid
    if (!addressLabel && cleaned.length === 42 && isAddress(cleaned, { strict: false }) && abiKey) {
      const abiLabel = getABILabel(abiLabels, abiKey)
      const addr = getAddress(cleaned)
      const label = `${abiLabel} ${addr.slice(0, 6)}...${addr.slice(-4)}`
      setAddressLabel(label)
    }
  }

  const handleAddressPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    
    // Try to clean and validate the pasted content
    let cleaned = pastedText.trim()
    
    // Remove any non-hex characters
    cleaned = cleaned.replace(/[^0-9a-fA-Fx]/g, "")
    
    // Ensure it starts with 0x
    if (cleaned && !cleaned.startsWith("0x")) {
      cleaned = "0x" + cleaned.replace(/^0x/, "")
    }
    
    // Limit to 42 characters
    if (cleaned.length > 42) {
      cleaned = cleaned.slice(0, 42)
    }
    
    // Validate: must be exactly 42 chars and valid hex after 0x
    if (cleaned.length !== 42) {
      toast.error("Invalid address format", {
        description: "Address must be 42 characters (0x + 40 hex characters)",
      })
      return
    }
    
    const hexPart = cleaned.slice(2)
    if (!/^[0-9a-fA-F]{40}$/.test(hexPart)) {
      toast.error("Invalid address format", {
        description: "Address must contain only hexadecimal characters",
      })
      return
    }
    
    // Final validation with viem (no checksum required)
    if (isAddress(cleaned, { strict: false })) {
      handleAddressChange(cleaned)
    } else {
      toast.error("Invalid address", {
        description: "The pasted address is not a valid Ethereum address",
      })
    }
  }

  const handleSelectAll = () => {
    setChainIds(availableChains.map((c) => c.id))
  }

  const handleSelectNone = () => {
    setChainIds([])
  }

  const handleDetect = async () => {
    if (!address || !isAddress(address, { strict: false })) {
      toast.error("Please enter a valid contract address first")
      return
    }

    setIsDetecting(true)
    const detectedChains: number[] = []
    const failedChains: string[] = []

    const { createPublicClient, http } = await import("viem")

    for (const chain of availableChains) {
      try {
        const client = createPublicClient({
          chain,
          transport: http(),
        })
        
        const code = await client.getBytecode({ address: address as Address })
        if (code && code !== "0x") {
          detectedChains.push(chain.id)
        }
      } catch (error) {
        failedChains.push(chain.name)
      }
    }

    setIsDetecting(false)
    setChainIds(detectedChains)

    if (failedChains.length > 0) {
      toast.warning(
        `Could not detect contract on: ${failedChains.join(", ")}`,
        {
          description: `Assuming not deployed on these chains`,
        }
      )
    } else if (detectedChains.length === 0) {
      toast.info("No contract code found on any chain")
    } else {
      toast.success(`Detected contract on ${detectedChains.length} chain(s)`)
    }
  }

  const handleAdd = async () => {
    if (!abiKey || !address || !addressLabel || chainIds.length === 0) {
      toast.error("Please fill in all fields")
      return
    }

    const trimmedLabel = addressLabel.trim()
    if (trimmedLabel.length > 75) {
      toast.error("Address Label is too long", {
        description: "Address label must be 75 characters or less",
      })
      return
    }

    if (!isAddress(address, { strict: false })) {
      toast.error("Invalid contract address")
      return
    }

    // Check for duplicate address across all contracts
    const normalizedAddress = getAddress(address)
    for (const [label, contract] of Object.entries(contracts)) {
      for (const addr of contract.addresses) {
        if (getAddress(addr.address) === normalizedAddress) {
          toast.error("Contract address already configured", {
            description: `Contract address ${normalizedAddress} is already configured in ${label}`,
          })
          return
        }
      }
    }

    // Check for unique address label per ABI
    const abiLabel = getABILabel(abiLabels, abiKey)
    for (const [label, contract] of Object.entries(contracts)) {
      if (contract.abi === abiKey) {
        for (const addr of contract.addresses) {
          if (addr.label === trimmedLabel) {
            toast.error("Address label must be unique per ABI", {
              description: `Address label "${trimmedLabel}" already exists for this ABI in ${label}`,
            })
            return
          }
        }
      }
    }

    try {
      const newContracts = addContract(
        contracts,
        abiLabel,
        abiKey,
        normalizedAddress,
        trimmedLabel,
        chainIds
      )
      await saveContracts(newContracts)
      setContracts(newContracts)
      toast.success("Contract added successfully")
      onOpenChange(false)
      setStep("select-abi")
      setAbiKey("")
      setAddress("")
      setAddressLabel("")
      setChainIds([])
    } catch (error) {
      toast.error("Failed to add contract", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const toggleChain = (chainId: number) => {
    setChainIds((prev) =>
      prev.includes(chainId)
        ? prev.filter((id) => id !== chainId)
        : [...prev, chainId]
    )
  }

  const selectedABILabel = abiKey ? getABILabel(abiLabels, abiKey) : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select-abi" ? "Select ABI" : "Add Contract Details"}
          </DialogTitle>
          <DialogDescription>
            {step === "select-abi"
              ? "Choose an ABI file to register a contract"
              : `Registering contract with ABI: ${selectedABILabel}`}
          </DialogDescription>
        </DialogHeader>

        {step === "select-abi" ? (
          <div className="space-y-4">
            {Object.keys(abis).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <p className="text-muted-foreground">No ABIs registered yet.</p>
                <Button onClick={() => setIsAddABIOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add ABI
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="abi-file">ABI</Label>
                <div className="flex gap-2">
                  <Select value={abiKey} onValueChange={setAbiKey}>
                    <SelectTrigger className="w-full z-10">
                      <SelectValue placeholder="Select ABI" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      {Object.keys(abis).map((key) => {
                        const label = getABILabel(abiLabels, key)
                        const truncated = truncateLabel(label)
                        return (
                          <SelectItem key={key} value={key}>
                            {truncated.display}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddABIOpen(true)}
                    title="Add ABI"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Contract Address</Label>
              <Input
                id="address"
                placeholder="0x..."
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onPaste={handleAddressPaste}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-label">Address Label</Label>
              <Input
                id="address-label"
                placeholder="Main Deployment"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                maxLength={75}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Supported Chains</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    ALL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectNone}
                  >
                    NONE
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDetect}
                    disabled={isDetecting || !address || !isAddress(address, { strict: false })}
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        DETECTING
                      </>
                    ) : (
                      "DETECT"
                    )}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {availableChains.map((chain) => (
                  <label
                    key={chain.id}
                    className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-accent rounded"
                  >
                    <input
                      type="checkbox"
                      checked={chainIds.includes(chain.id)}
                      onChange={() => toggleChain(chain.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{chain.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "select-abi" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleABISelected} disabled={!abiKey}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("select-abi")}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add Contract</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <AddABIModal
        open={isAddABIOpen}
        onOpenChange={setIsAddABIOpen}
      />
    </Dialog>
  )
}
