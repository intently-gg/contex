import { useState, useEffect, useRef, useMemo } from "react"
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
import { Loader2, ChevronRight, ChevronLeft, Plus, Search } from "lucide-react"
import type { Address, Abi } from "viem"
import { isAddress, getAddress } from "viem"
import { parseABI } from "@/lib/abiParser"
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
  const { contracts, setContracts, setSelectedAbiKey, setSelectedAddress } = useContractStore()
  const { abis } = useABIStore()
  const [step, setStep] = useState<Step>("select-abi")
  const [abiKey, setAbiKey] = useState("")
  const [address, setAddress] = useState("")
  const [addressLabel, setAddressLabel] = useState("")
  const [chainIds, setChainIds] = useState<number[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [isAddABIOpen, setIsAddABIOpen] = useState(false)
  const [chainSearchQuery, setChainSearchQuery] = useState("")
  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Modal just opened - initialize state
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
      setChainSearchQuery("")
    }
    prevOpenRef.current = open
  }, [open, abis, defaultAbiKey])

  // Ensure abiKey is always set when on contract-details step
  useEffect(() => {
    if (step === "contract-details" && !abiKey && Object.keys(abis).length > 0) {
      // If somehow we're on contract-details without an abiKey, set the first available
      const abiKeys = Object.keys(abis)
      if (abiKeys.length > 0) {
        setAbiKey(abiKeys[0])
      }
    }
  }, [step, abiKey, abis])

  const availableChains = config.chains

  const filteredChains = useMemo(() => {
    if (!chainSearchQuery.trim()) return availableChains
    const query = chainSearchQuery.toLowerCase()
    return availableChains.filter((chain) =>
      chain.name.toLowerCase().includes(query)
    )
  }, [availableChains, chainSearchQuery])

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
      const abiLabel = getABILabel(abis, abiKey)
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

  const handleSelectNone = () => {
    setChainIds([])
  }

  const handleDetect = async () => {
    if (!address || !isAddress(address, { strict: false })) {
      toast.error("Please enter a valid contract address first")
      return
    }

    if (!abiKey) {
      toast.error("Please select an ABI first")
      return
    }

    setIsDetecting(true)
    const failedChains: string[] = []

    const { createPublicClient, http } = await import("viem")

    // Find the first read function with no input parameters (once, reuse for all chains)
    const abi = abis[abiKey]?.abi as Abi | undefined
    let readFunctionWithNoParams: { name: string; abiFunction: any } | null = null
    
    if (abi) {
      const parsed = parseABI(abi)
      if (parsed) {
        const readFunc = parsed.find((f) => f.type === "read" && f.inputs.length === 0)
        if (readFunc) {
          readFunctionWithNoParams = {
            name: readFunc.name,
            abiFunction: readFunc.abiFunction,
          }
        }
      }
    }

    // Helper function to create a 1-second timeout promise
    const createTimeoutPromise = () => {
      return new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 1000)
      })
    }

    const detectionPromises = availableChains.map(async (chain) => {
      try {
        const client = createPublicClient({
          chain,
          transport: http(),
        })
        
        // Step 1: Check code first (synchronous step within async call)
        const code = await client.getBytecode({ address: address as Address })
        const hasCode = code && code !== "0x"
        
        if (!hasCode) {
          return { chainId: chain.id, hasCode: false, functionCheckPassed: false }
        }

        // Step 2: If code exists and we have a read function, try to call it
        if (readFunctionWithNoParams) {
          try {
            // Race the function call against a 1-second timeout
            const functionCall = client.readContract({
              address: address as Address,
              abi: [readFunctionWithNoParams.abiFunction],
              functionName: readFunctionWithNoParams.name,
            })

            await Promise.race([functionCall, createTimeoutPromise()])
            // If we get here, the function call completed successfully within 1s
            return { chainId: chain.id, hasCode: true, functionCheckPassed: true }
          } catch (error) {
            // Function call failed or timed out
            return { chainId: chain.id, hasCode: true, functionCheckPassed: false }
          }
        } else {
          // No read function with no params - fallback to code-only detection
          return { chainId: chain.id, hasCode: true, functionCheckPassed: true }
        }
      } catch (error) {
        failedChains.push(chain.name)
        return { chainId: chain.id, hasCode: false, functionCheckPassed: false }
      }
    })

    const results = await Promise.all(detectionPromises)
    
    // Separate chains by their check results
    const chainsWithCode = results.filter((r) => r.hasCode)
    const chainsWithFunctionCheck = results.filter((r) => r.functionCheckPassed)
    
    // If we found some that passed code check but NONE passed function check,
    // assume those with code are OK (handles poor function choice)
    let detectedChains: number[]
    if (chainsWithCode.length > 0 && chainsWithFunctionCheck.length === 0 && readFunctionWithNoParams) {
      // Fallback: use code-check results
      detectedChains = chainsWithCode.map((r) => r.chainId)
    } else {
      // Normal case: use function check results (or code-only if no function available)
      detectedChains = chainsWithFunctionCheck.map((r) => r.chainId)
    }

    setIsDetecting(false)
    setChainIds(detectedChains)

    // Always show a toast with the list of detected chains (if any)
    if (detectedChains.length > 0) {
      const detectedChainNames = detectedChains
        .map((chainId) => {
          const chain = availableChains.find((c) => c.id === chainId)
          return chain?.name || `Chain ${chainId}`
        })
        .join(", ")
      
      toast.success("Chains detected and enabled", {
        description: detectedChainNames,
      })
    }

    // Show other toasts as well (they will all display)
    if (failedChains.length > 0) {
      toast.warning(
        `Could not detect contract on: ${failedChains.join(", ")}`,
        {
          description: `Assuming not deployed on these chains`,
        }
      )
    }
    
    if (detectedChains.length === 0) {
      toast.info("No contract code found on any chain")
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
    for (const [key, addresses] of Object.entries(contracts)) {
      for (const addr of addresses) {
        if (getAddress(addr.address) === normalizedAddress) {
          const abiLabel = getABILabel(abis, key)
          toast.error("Contract address already configured", {
            description: `Contract address ${normalizedAddress} is already configured in ${abiLabel}`,
          })
          return
        }
      }
    }

    // Check for unique address label per ABI
    if (contracts[abiKey]) {
      for (const addr of contracts[abiKey]) {
        if (addr.label === trimmedLabel) {
          const abiLabel = getABILabel(abis, abiKey)
          toast.error("Address label must be unique per ABI", {
            description: `Address label "${trimmedLabel}" already exists for this ABI in ${abiLabel}`,
          })
          return
        }
      }
    }

    try {
      const newContracts = addContract(
        contracts,
        abiKey,
        normalizedAddress,
        trimmedLabel,
        chainIds
      )
      await saveContracts(newContracts)
      setContracts(newContracts)
      
      // Switch to the newly added contract
      setSelectedAbiKey(abiKey)
      const newAddressIndex = newContracts[abiKey].length - 1
      setSelectedAddress(abiKey, newAddressIndex)
      
      toast.success("Contract added successfully")
      onOpenChange(false)
      setStep("select-abi")
      setAbiKey("")
      setAddress("")
      setAddressLabel("")
      setChainIds([])
      setChainSearchQuery("")
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
              : "Enter the contract details below"}
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
                        const label = getABILabel(abis, key)
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
              <Label htmlFor="abi-file">ABI</Label>
              <div className="flex gap-2">
                <Select value={abiKey} onValueChange={setAbiKey}>
                  <SelectTrigger className="w-full z-10">
                    <SelectValue placeholder="Select ABI" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-popover">
                    {Object.keys(abis).map((key) => {
                      const label = getABILabel(abis, key)
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
                <Label>Enabled Chains</Label>
                <div className="flex gap-2">
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search chains..."
                  value={chainSearchQuery}
                  onChange={(e) => setChainSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                {filteredChains.map((chain) => (
                  <label
                    key={chain.id}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-accent rounded"
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
        onABIAdded={(newAbiKey) => {
          setAbiKey(newAbiKey)
          setStep("contract-details")
        }}
      />
    </Dialog>
  )
}
