import { useState, useEffect } from "react"
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
import { toast } from "sonner"
import { Trash2, Plus, Pencil, Eye, Copy } from "lucide-react"
import { loadABILabels, saveABILabels, getABILabel } from "@/lib/abiLabels"
import { EditLabelDialog } from "./EditLabelDialog"
import Editor from "@monaco-editor/react"
import { useThemeStore } from "@/stores/themeStore"
import { safeStringify } from "@/lib/utils"

interface ABIManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ABIManagerModal({
  open,
  onOpenChange,
}: ABIManagerModalProps) {
  const [abis, setAbis] = useState<Record<string, unknown>>({})
  const [abiLabels, setAbiLabels] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [newAbiName, setNewAbiName] = useState("")
  const [newAbiLabel, setNewAbiLabel] = useState("")
  const [newAbiContent, setNewAbiContent] = useState("")
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null)
  const [viewingAbi, setViewingAbi] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { theme } = useThemeStore()

  useEffect(() => {
    if (open) {
      fetch("/api/abis")
        .then((res) => res.json())
        .then(setAbis)
        .catch(console.error)
      loadABILabels().then(setAbiLabels).catch(console.error)
    }
  }, [open])

  const handleAdd = async () => {
    if (!newAbiName || !newAbiContent) {
      toast.error("Please provide both name and ABI content")
      return
    }

    // Validate filename: only alphanumerics, hyphens, and underscores
    const baseName = newAbiName.replace(/\.json$/, "")
    if (!/^[a-zA-Z0-9_-]+$/.test(baseName)) {
      toast.error("Filename can only contain letters, numbers, hyphens, and underscores")
      return
    }

    // Auto-append .json if not present
    const filename = newAbiName.endsWith(".json") ? newAbiName : `${newAbiName}.json`

    if (jsonError) {
      toast.error("Invalid JSON", {
        description: jsonError,
      })
      return
    }

    try {
      const response = await fetch("/api/abis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          content: newAbiContent,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save ABI")
      }

      // Save label if provided
      if (newAbiLabel) {
        const updatedLabels = { ...abiLabels, [filename]: newAbiLabel }
        await saveABILabels(updatedLabels)
        setAbiLabels(updatedLabels)
      }

      toast.success("ABI added successfully")
      setNewAbiName("")
      setNewAbiLabel("")
      setNewAbiContent("")
      setIsAdding(false)
      fetch("/api/abis")
        .then((res) => res.json())
        .then(setAbis)
        .catch(console.error)
    } catch (error) {
      toast.error("Failed to add ABI", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleUpdateLabel = async (filename: string, newLabel: string) => {
    try {
      const updatedLabels = { ...abiLabels, [filename]: newLabel }
      await saveABILabels(updatedLabels)
      setAbiLabels(updatedLabels)
      setEditingLabel(null)
      toast.success("Label updated")
    } catch (error) {
      toast.error("Failed to update label")
    }
  }

  const handleDeleteClick = (filename: string) => {
    setDeleteConfirmOpen(filename)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmOpen) return

    try {
      const response = await fetch(`/api/abis?filename=${encodeURIComponent(deleteConfirmOpen)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete ABI")
      }

      toast.success("ABI deleted successfully")
      fetch("/api/abis")
        .then((res) => res.json())
        .then(setAbis)
        .catch(console.error)
      setDeleteConfirmOpen(null)
    } catch (error) {
      toast.error("Failed to delete ABI", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleViewAbi = (filename: string) => {
    setViewingAbi(filename)
  }

  const handleCopyAbi = async (abi: unknown) => {
    try {
      await navigator.clipboard.writeText(safeStringify(abi))
      toast.success("ABI copied to clipboard")
    } catch {
      toast.error("Failed to copy ABI")
    }
  }

  const validateJson = (content: string): string | null => {
    try {
      JSON.parse(content)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON"
    }
  }

  const handleAbiContentChange = (value: string | undefined) => {
    const content = value || ""
    setNewAbiContent(content)
    const error = validateJson(content)
    setJsonError(error)
  }

  return (
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
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add ABI
            </Button>
          </div>

          {isAdding && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="abi-name">Filename (letters, numbers, hyphens, underscores only)</Label>
                <Input
                  id="abi-name"
                  placeholder="MyContract"
                  value={newAbiName}
                  onChange={(e) => {
                    // Only allow alphanumerics, hyphens, underscores, and .json
                    const value = e.target.value
                    const baseName = value.replace(/\.json$/, "")
                    if (baseName === "" || /^[a-zA-Z0-9_-]*$/.test(baseName)) {
                      setNewAbiName(value)
                      // Auto-populate label if empty
                      if (!newAbiLabel) {
                        setNewAbiLabel(baseName)
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  .json will be added automatically
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abi-label">Contract Label</Label>
                <Input
                  id="abi-label"
                  placeholder="My Contract"
                  value={newAbiLabel}
                  onChange={(e) => setNewAbiLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Display name for this ABI
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abi-content">ABI JSON Content</Label>
                <div className="border rounded-md overflow-hidden" style={{ height: "400px" }}>
                  <Editor
                    height="400px"
                    defaultLanguage="json"
                    value={newAbiContent}
                    onChange={handleAbiContentChange}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd}>Save</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false)
                    setNewAbiName("")
                    setNewAbiLabel("")
                    setNewAbiContent("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {Object.keys(abis).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No ABI files found. Add one to get started.
              </p>
            ) : (
              Object.keys(abis).map((filename) => {
                const label = getABILabel(abiLabels, filename)
                return (
                  <div
                    key={filename}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {filename}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewAbi(filename)}
                        title="View ABI"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLabel(filename)}
                        title="Edit Label"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(filename)}
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
        {editingLabel && (
          <EditLabelDialog
            open={!!editingLabel}
            onOpenChange={(open) => !open && setEditingLabel(null)}
            currentLabel={getABILabel(abiLabels, editingLabel)}
            onSave={(newLabel) => handleUpdateLabel(editingLabel, newLabel)}
            title="Edit ABI Label"
            description="Update the display label for this ABI"
          />
        )}
      </DialogContent>

      <AlertDialog open={!!deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ABI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirmOpen}? This action cannot be undone.
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

      <Dialog open={!!viewingAbi} onOpenChange={(open) => !open && setViewingAbi(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>View ABI: {viewingAbi}</DialogTitle>
            <DialogDescription>
              {viewingAbi && getABILabel(abiLabels, viewingAbi)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-md overflow-hidden" style={{ height: "500px" }}>
              {viewingAbi && abis[viewingAbi] ? (
                <Editor
                  height="500px"
                  defaultLanguage="json"
                  value={safeStringify(abis[viewingAbi])}
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
                onClick={() => viewingAbi && abis[viewingAbi] && handleCopyAbi(abis[viewingAbi])}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy ABI
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

