import { useState, useMemo } from "react"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Trash2, Plus, Pencil, Eye } from "lucide-react"
import { getABILabel } from "@/lib/abiLabels"
import { useABIStore } from "@/stores/abiStore"
import { useContractStore } from "@/stores/contractStore"
import { EditLabelDialog } from "./EditLabelDialog"
import { AddABIModal } from "./AddABIModal"
import { AddContractModal } from "./AddContractModal"
import { truncateLabel } from "@/lib/utils"
import { ResultRenderer } from "@/components/shared/ResultRenderer"

interface ABIManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ABIManagerModal({
  open,
  onOpenChange,
}: ABIManagerModalProps) {
  const { abis, deleteABI, setABILabel, isLabelUnique } = useABIStore()
  const { contracts } = useContractStore()
  const [isAddABIOpen, setIsAddABIOpen] = useState(false)
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [addContractAbiKey, setAddContractAbiKey] = useState<string | undefined>(undefined)
  const [editingAbiKey, setEditingAbiKey] = useState<string | null>(null)
  const [deleteConfirmAbiKey, setDeleteConfirmAbiKey] = useState<string | null>(null)
  const [viewingAbiKey, setViewingAbiKey] = useState<string | null>(null)

  const contractsUsingABI = useMemo(() => {
    if (!deleteConfirmAbiKey) return []
    return Object.entries(contracts)
      .filter(([abiKey]) => abiKey === deleteConfirmAbiKey)
      .flatMap(([, addresses]) => addresses.map(addr => addr.label))
  }, [contracts, deleteConfirmAbiKey])

  const handleUpdateLabel = (abiKey: string, newLabel: string) => {
    const trimmedLabel = newLabel.trim()
    if (!trimmedLabel) {
      toast.error("ABI Label is required")
      return
    }

    if (trimmedLabel.length > 75) {
      toast.error("ABI Label is too long", {
        description: "ABI label must be 75 characters or less",
      })
      return
    }

    if (!isLabelUnique(trimmedLabel, abiKey)) {
      toast.error("ABI label must be unique", {
        description: `ABI label "${trimmedLabel}" already exists`,
      })
      return
    }

    try {
      setABILabel(abiKey, trimmedLabel)
      setEditingAbiKey(null)
      toast.success("Label updated")
    } catch (error) {
      toast.error("Failed to update label")
    }
  }

  const handleDeleteClick = (abiKey: string) => {
    setDeleteConfirmAbiKey(abiKey)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAbiKey) return

    try {
      // Delete contracts that use this ABI
      const { setContracts, contracts: currentContracts } = useContractStore.getState()
      const updatedContracts = { ...currentContracts }
      let deletedCount = 0
      
      // Delete all addresses for this ABI
      if (currentContracts[deleteConfirmAbiKey]) {
        delete updatedContracts[deleteConfirmAbiKey]
        deletedCount = currentContracts[deleteConfirmAbiKey].length
      }
      
      if (deletedCount > 0) {
        setContracts(updatedContracts)
        // Also save to server
        const { saveContracts } = await import("@/lib/contractRegistry")
        await saveContracts(updatedContracts)
      }
      
      // Delete the ABI
      deleteABI(deleteConfirmAbiKey)
      toast.success(`ABI and ${deletedCount} contract${deletedCount !== 1 ? 's' : ''} deleted successfully`)
      setDeleteConfirmAbiKey(null)
    } catch (error) {
      toast.error("Failed to delete ABI", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleViewAbi = (abiKey: string) => {
    setViewingAbiKey(abiKey)
  }

  const handleAddContract = (abiKey: string) => {
    setAddContractAbiKey(abiKey)
    setIsAddContractOpen(true)
    onOpenChange(false)
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage ABIs</DialogTitle>
          <DialogDescription>
            Add, view, and delete ABI files. Paste JSON content directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">ABI Files</h3>
            <Button onClick={() => setIsAddABIOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add ABI
            </Button>
          </div>

          <div className="space-y-2">
            {Object.keys(abis).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No ABI files found. Add one to get started.
              </p>
            ) : (
              Object.keys(abis).map((abiKey) => {
                const label = getABILabel(abis, abiKey)
                const truncated = truncateLabel(label)
                return (
                  <div
                    key={abiKey}
                    className="flex items-center justify-between border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewAbi(abiKey)}
                        title="View ABI"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingAbiKey(abiKey)}
                        title="Edit Label"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddContract(abiKey)}
                        title="Add Contract"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-medium truncate">{truncated.display}</div>
                          </TooltipTrigger>
                          {truncated.display !== truncated.full ? (
                            <TooltipContent>
                              <p>{truncated.full}</p>
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(abiKey)}
                      title="Delete ABI"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
        {editingAbiKey && (
          <EditLabelDialog
            open={!!editingAbiKey}
            onOpenChange={(open) => !open && setEditingAbiKey(null)}
            currentLabel={getABILabel(abis, editingAbiKey)}
            onSave={(newLabel) => handleUpdateLabel(editingAbiKey, newLabel)}
            title="Edit ABI Label"
            description="Update the display label for this ABI"
          />
        )}
      </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmAbiKey} onOpenChange={(open) => !open && setDeleteConfirmAbiKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ABI</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmAbiKey && (
                <>
                  Are you sure you want to delete "{getABILabel(abis, deleteConfirmAbiKey)}"?
                  {contractsUsingABI.length > 0 && (
                    <>
                      <br /><br />
                      <strong>Warning:</strong> This will also delete {contractsUsingABI.length} contract{contractsUsingABI.length !== 1 ? 's' : ''} that use this ABI:
                      <ul className="list-disc list-inside mt-2">
                        {contractsUsingABI.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <br /><br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingAbiKey} onOpenChange={(open) => !open && setViewingAbiKey(null)}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>View ABI: {viewingAbiKey && getABILabel(abis, viewingAbiKey)}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {viewingAbiKey && abis[viewingAbiKey] ? (
              <ResultRenderer value={abis[viewingAbiKey].abi} className="h-full" defaultFormat="json" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AddABIModal
        open={isAddABIOpen}
        onOpenChange={setIsAddABIOpen}
      />

      <AddContractModal
        open={isAddContractOpen}
        onOpenChange={(open) => {
          setIsAddContractOpen(open)
          if (!open) {
            setAddContractAbiKey(undefined)
          }
        }}
        defaultAbiKey={addContractAbiKey}
      />
    </>
  )
}

