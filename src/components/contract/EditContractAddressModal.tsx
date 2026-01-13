import { useState, useEffect, useMemo } from "react"
import { useChainId, useChains } from "wagmi"
import type { Address } from "viem"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { updateAddressLabel, updateAddressChainIds, deleteAddress, saveContracts } from "@/lib/contractRegistry"
import { getABILabel } from "@/lib/abiLabels"
import { copyToClipboard } from "@/lib/utils"
import { config } from "@/lib/wagmi"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Trash2, Copy, ExternalLink, Check, Search } from "lucide-react"

interface EditContractAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  abiKey: string
  address: Address
}

export function EditContractAddressModal({
  open,
  onOpenChange,
  abiKey,
  address: addressProp,
}: EditContractAddressModalProps) {
  const { contracts, setContracts } = useContractStore()
  const { abis } = useABIStore()
  const [addressLabel, setAddressLabel] = useState("")
  const [chainIds, setChainIds] = useState<number[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chainSearchQuery, setChainSearchQuery] = useState("")
  const chainId = useChainId()
  const chains = useChains()

  const availableChains = config.chains
  const addresses = contracts[abiKey] || []
  const address = addresses.find((addr) => addr.address.toLowerCase() === addressProp.toLowerCase())

  const scannerUrl = useMemo(() => {
    if (!address) return null
    const currentChain = chains.find((c) => c.id === chainId && address.chainIds.includes(c.id))
    const chain = currentChain || availableChains.find((c) => address.chainIds.includes(c.id))
    if (!chain?.blockExplorers?.default?.url) return null
    return `${chain.blockExplorers.default.url}/address/${address.address}`
  }, [address, chainId, chains, availableChains])

  useEffect(() => {
    if (open && address) {
      setAddressLabel(address.label)
      setChainIds(address.chainIds)
      setChainSearchQuery("")
    }
  }, [open, address])

  const filteredChains = useMemo(() => {
    if (!chainSearchQuery.trim()) return availableChains
    const query = chainSearchQuery.toLowerCase()
    return availableChains.filter((chain) =>
      chain.name.toLowerCase().includes(query)
    )
  }, [availableChains, chainSearchQuery])

  const handleSave = async () => {
    const trimmedLabel = addressLabel.trim()
    if (!trimmedLabel) {
      toast.error("Address label is required")
      return
    }

    if (trimmedLabel.length > 75) {
      toast.error("Address Label is too long", {
        description: "Address label must be 75 characters or less",
      })
      return
    }

    if (chainIds.length === 0) {
      toast.error("Please select at least one chain")
      return
    }

    try {
      let updated = updateAddressLabel(contracts, abiKey, addressProp, trimmedLabel)
      updated = updateAddressChainIds(updated, abiKey, addressProp, chainIds)
      await saveContracts(updated)
      setContracts(updated)
      toast.success("Contract address updated successfully")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to update contract address", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleDelete = async () => {
    try {
      const addressCount = addresses.length
      let updated = deleteAddress(contracts, abiKey, addressProp)
      
      // If this was the last address, the contract is deleted
      if (addressCount === 1) {
        toast.success("Contract and address deleted successfully")
      } else {
        toast.success("Address deleted successfully")
      }
      
      await saveContracts(updated)
      setContracts(updated)
      setDeleteConfirmOpen(false)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to delete address", {
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

  const handleCopyAddress = async () => {
    if (!address) return
    const success = await copyToClipboard(address.address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!address) return null

  const abiLabel = getABILabel(abis, abiKey)
  const addressCount = addresses.length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract Address</DialogTitle>
            <DialogDescription>
              Edit address details for {abiLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ABI</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input value={abiLabel} disabled className="bg-muted" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>ABI cannot be changed after creation</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Contract Address</Label>
                {scannerUrl && (
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
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input value={address.address} disabled className="bg-muted font-mono" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Address cannot be changed after creation</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-label">Address Label</Label>
              <Input
                id="address-label"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                placeholder="Main Deployment"
                maxLength={75}
              />
            </div>
            <div className="space-y-2">
              <Label>Enabled Chains</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search chains..."
                  value={chainSearchQuery}
                  onChange={(e) => setChainSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {filteredChains.map((chain) => (
                  <div key={chain.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chain-${chain.id}`}
                      checked={chainIds.includes(chain.id)}
                      onCheckedChange={() => toggleChain(chain.id)}
                    />
                    <Label
                      htmlFor={`chain-${chain.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {chain.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract Address</AlertDialogTitle>
            <AlertDialogDescription>
              {addressCount === 1
                ? `You are about to delete ${abiLabel} and ${addressCount} underlying Contract Address. This action cannot be undone.`
                : `You are about to delete this Contract Address from ${abiLabel}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

