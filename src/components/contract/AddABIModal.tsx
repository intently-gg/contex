import { useState, useEffect, useRef, useCallback } from "react"
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
import Editor, { type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { useThemeStore } from "@/stores/themeStore"
import { FetchABIModal } from "./FetchABIModal"
import { Abi } from "abitype/zod"

interface AddABIModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onABIAdded?: (abiKey: string) => void
}

export function AddABIModal({
  open,
  onOpenChange,
  onABIAdded,
}: AddABIModalProps) {
  const { addABI, isLabelUnique } = useABIStore()
  const [newAbiLabel, setNewAbiLabel] = useState("")
  const [newAbiContent, setNewAbiContent] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isFetchModalOpen, setIsFetchModalOpen] = useState(false)
  const { theme } = useThemeStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (open) {
      setNewAbiLabel("")
      setNewAbiContent("")
      setJsonError(null)
      setIsFetchModalOpen(false)
    }
  }, [open])

  const handleABIFetched = (abi: unknown[]) => {
    try {
      const formatted = JSON.stringify(abi, null, 2)
      setNewAbiContent(formatted)
      setJsonError(null)
      
      setTimeout(() => {
        editorRef.current?.getAction("editor.action.formatDocument")?.run()
      }, 0)
    } catch (error) {
      toast.error("Failed to format fetched ABI", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
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

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData("text")
      
      if (!pastedText || pastedText.trim() === "") {
        return
      }

      const hasLineBreaks = pastedText.includes("\n") || pastedText.includes("\r")
      
      if (!hasLineBreaks) {
        try {
          const parsed = JSON.parse(pastedText)
          const formatted = JSON.stringify(parsed, null, 2)
          
          e.preventDefault()
          
          const selection = editor.getSelection()
          if (selection) {
            const range = new monaco.Range(
              selection.startLineNumber,
              selection.startColumn,
              selection.endLineNumber,
              selection.endColumn
            )
            
            editor.executeEdits("auto-format-paste", [
              {
                range,
                text: formatted,
              },
            ])
            
            setTimeout(() => {
              editor.getAction("editor.action.formatDocument")?.run()
            }, 0)
          }
        } catch {
          // If parsing fails, let Monaco handle it normally
        }
      }
    }

    const editorDomNode = editor.getContainerDomNode()
    editorDomNode.addEventListener("paste", handlePaste)

    return () => {
      editorDomNode.removeEventListener("paste", handlePaste)
    }
  }, [])

  const handleFormat = () => {
    if (!editorRef.current) {
      return
    }

    try {
      const parsed = JSON.parse(newAbiContent)
      const formatted = JSON.stringify(parsed, null, 2)
      setNewAbiContent(formatted)
      setJsonError(null)
      
      setTimeout(() => {
        editorRef.current?.getAction("editor.action.formatDocument")?.run()
      }, 0)
    } catch (error) {
      toast.error("Invalid JSON", {
        description: error instanceof Error ? error.message : "Cannot format invalid JSON",
      })
    }
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
      
      // Validate that it's a valid and parseable ABI using abitype's Zod schema
      try {
        Abi.parse(parsedContent)
      } catch (abiError) {
        // Log full error details to console for debugging
        console.error("ABI validation error:", abiError)
        toast.error("Invalid ABI", {
          description: (
            <>
              ABI content is valid JSON, but could not be understood as a valid ABI schema/structure.
              <br />
              <br />
              Please double check your supplied ABI for errors or extraneous content.
            </>
          ),
          duration: 15000,
        })
        return
      }

      const abiKey = addABI(trimmedLabel, parsedContent)
      toast.success("ABI added successfully")
      onOpenChange(false)
      if (onABIAdded) {
        onABIAdded(abiKey)
      }
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
            <Label htmlFor="abi-label">ABI Label</Label>
            <Input
              id="abi-label"
              placeholder="eg: ERC20, UniswapV3, etc."
              value={newAbiLabel}
              onChange={(e) => setNewAbiLabel(e.target.value)}
              maxLength={75}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abi-content">ABI JSON Content</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFetchModalOpen(true)}
              >
                Fetch from Etherscan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFormat}
              >
                Auto-Format
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden" style={{ height: "400px" }}>
              <Editor
                height="400px"
                defaultLanguage="json"
                value={newAbiContent}
                onChange={handleAbiContentChange}
                onMount={handleEditorDidMount}
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <FetchABIModal
        open={isFetchModalOpen}
        onOpenChange={setIsFetchModalOpen}
        onABIFetched={handleABIFetched}
      />
    </Dialog>
  )
}

