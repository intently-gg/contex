import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useABIStore } from "@/stores/abiStore"
import Editor from "@monaco-editor/react"
import { useThemeStore } from "@/stores/themeStore"

interface AddABIModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddABIModal({
  open,
  onOpenChange,
}: AddABIModalProps) {
  const { addABI, isLabelUnique } = useABIStore()
  const [newAbiLabel, setNewAbiLabel] = useState("")
  const [newAbiContent, setNewAbiContent] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { theme } = useThemeStore()

  useEffect(() => {
    if (open) {
      setNewAbiLabel("")
      setNewAbiContent("")
      setJsonError(null)
    }
  }, [open])

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

  const handleAdd = async () => {
    if (!newAbiLabel || !newAbiLabel.trim()) {
      toast.error("ABI Label is required")
      return
    }

    const trimmedLabel = newAbiLabel.trim()
    if (trimmedLabel.length > 75) {
      toast.error("ABI Label is too long", {
        description: "ABI label must be 75 characters or less",
      })
      return
    }

    if (!newAbiContent) {
      toast.error("ABI content is required")
      return
    }

    if (jsonError) {
      toast.error("Invalid JSON", {
        description: jsonError,
      })
      return
    }

    // Check for unique ABI label
    if (!isLabelUnique(trimmedLabel)) {
      toast.error("ABI label must be unique", {
        description: `ABI label "${trimmedLabel}" already exists`,
      })
      return
    }

    try {
      const parsedContent = JSON.parse(newAbiContent)
      addABI(trimmedLabel, parsedContent)
      toast.success("ABI added successfully")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to add ABI", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add ABI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="abi-label">ABI Label *</Label>
            <Input
              id="abi-label"
              placeholder="My Contract"
              value={newAbiLabel}
              onChange={(e) => setNewAbiLabel(e.target.value)}
              maxLength={75}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abi-content">ABI JSON Content <i>(Paste directly)</i></Label>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

