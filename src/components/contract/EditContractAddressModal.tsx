import { useState, useEffect, useMemo } from "react"
import { useChainId, useChains } from "wagmi"
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
import { Trash2, Copy, ExternalLink, Check } from "lucide-react"

interface EditContractAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractLabel: string
  addressIndex: number
}

export function EditContractAddressModal({
  open,
  onOpenChange,
  contractLabel,
  addressIndex,
}: EditContractAddressModalProps) {
  const { contracts, setContracts } = useContractStore()
  const { abiLabels } = useABIStore()
  const [addressLabel, setAddressLabel] = useState("")
  const [chainIds, setChainIds] = useState<number[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const chainId = useChainId()
  const chains = useChains()

  const availableChains = config.chains
  const contract = contracts[contractLabel]
  const address = contract?.addresses[addressIndex]

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
    }
  }, [open, address, contract])

  const handleSave = async () => {
    if (!addressLabel.trim()) {
      toast.error("Address label is required")
      return
    }

    if (chainIds.length === 0) {
      toast.error("Please select at least one chain")
      return
    }

    try {
      let updated = updateAddressLabel(contracts, contractLabel, addressIndex, addressLabel.trim())
      updated = updateAddressChainIds(updated, contractLabel, addressIndex, chainIds)
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
      const addressCount = contract.addresses.length
      let updated = deleteAddress(contracts, contractLabel, addressIndex)
      
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

  if (!contract || !address) return null

  const abiLabel = getABILabel(abiLabels, contract.abi)
  const addressCount = contract.addresses.length

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
              />
            </div>
            <div className="space-y-2">
              <Label>Supported Chains</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChainIds(availableChains.map((c) => c.id))}
                >
                  ALL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChainIds([])}
                >
                  NONE
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {availableChains.map((chain) => (
                  <div key={chain.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`chain-${chain.id}`}
                      checked={chainIds.includes(chain.id)}
                      onCheckedChange={() => toggleChain(chain.id)}
                    />
                    <Label
                      htmlFor={`chain-${chain.id}`}
                      className="text-sm font-normal cursor-pointer"
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
                ? `You are about to delete ${contractLabel} and ${addressCount} underlying Contract Address. This action cannot be undone.`
                : `You are about to delete this Contract Address from ${contractLabel}. This action cannot be undone.`}
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

