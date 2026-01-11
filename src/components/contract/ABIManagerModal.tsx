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
import { toast } from "sonner"
import { Trash2, Plus, Pencil, Eye, Copy, Check } from "lucide-react"
import { getABILabel } from "@/lib/abiLabels"
import { useABIStore } from "@/stores/abiStore"
import { useContractStore } from "@/stores/contractStore"
import { EditLabelDialog } from "./EditLabelDialog"
import { AddABIModal } from "./AddABIModal"
import Editor from "@monaco-editor/react"
import { useThemeStore } from "@/stores/themeStore"
import { safeStringify, copyToClipboard } from "@/lib/utils"

interface ABIManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ABIManagerModal({
  open,
  onOpenChange,
}: ABIManagerModalProps) {
  const { abis, abiLabels, deleteABI, setABILabel, isLabelUnique } = useABIStore()
  const { contracts } = useContractStore()
  const [isAddABIOpen, setIsAddABIOpen] = useState(false)
  const [editingAbiKey, setEditingAbiKey] = useState<string | null>(null)
  const [deleteConfirmAbiKey, setDeleteConfirmAbiKey] = useState<string | null>(null)
  const [viewingAbiKey, setViewingAbiKey] = useState<string | null>(null)
  const [copiedAbi, setCopiedAbi] = useState(false)
  const { theme } = useThemeStore()

  const contractsUsingABI = useMemo(() => {
    if (!deleteConfirmAbiKey) return []
    return Object.entries(contracts).filter(
      ([, contract]) => contract.abi === deleteConfirmAbiKey
    ).map(([label]) => label)
  }, [contracts, deleteConfirmAbiKey])

  const handleUpdateLabel = (abiKey: string, newLabel: string) => {
    if (!newLabel || !newLabel.trim()) {
      toast.error("ABI Label is required")
      return
    }

    if (!isLabelUnique(newLabel.trim(), abiKey)) {
      toast.error("ABI label must be unique", {
        description: `ABI label "${newLabel.trim()}" already exists`,
      })
      return
    }

    try {
      setABILabel(abiKey, newLabel.trim())
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
      
      for (const [contractLabel, contract] of Object.entries(currentContracts)) {
        if (contract.abi === deleteConfirmAbiKey) {
          delete updatedContracts[contractLabel]
          deletedCount++
        }
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

  const handleCopyAbi = async (abi: unknown) => {
    const success = await copyToClipboard(safeStringify(abi))
    if (success) {
      setCopiedAbi(true)
      setTimeout(() => setCopiedAbi(false), 1000)
      toast.success("ABI copied to clipboard")
    } else {
      toast.error("Failed to copy ABI")
    }
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
                const label = getABILabel(abiLabels, abiKey)
                return (
                  <div
                    key={abiKey}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{label}</div>
                      </div>
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
            currentLabel={getABILabel(abiLabels, editingAbiKey)}
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
                  Are you sure you want to delete "{getABILabel(abiLabels, deleteConfirmAbiKey)}"?
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
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>View ABI: {viewingAbiKey && getABILabel(abiLabels, viewingAbiKey)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-md overflow-hidden" style={{ height: "500px" }}>
              {viewingAbiKey && abis[viewingAbiKey] ? (
                <Editor
                  height="500px"
                  defaultLanguage="json"
                  value={safeStringify(abis[viewingAbiKey])}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                  }}
                />
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => viewingAbiKey && abis[viewingAbiKey] && handleCopyAbi(abis[viewingAbiKey])}
              >
                {copiedAbi ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy ABI
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddABIModal
        open={isAddABIOpen}
        onOpenChange={setIsAddABIOpen}
      />
    </>
  )
}

