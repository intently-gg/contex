import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WrapText, Copy, Check } from "lucide-react"
import Editor from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { stringify as yamlStringify } from "yaml"
import { safeStringify, copyToClipboard } from "@/lib/utils"
import { useThemeStore } from "@/stores/themeStore"
import { toast } from "sonner"

interface ResultRendererProps {
  value: unknown
  className?: string
}

export function ResultRenderer({ value, className }: ResultRendererProps) {
  const { theme } = useThemeStore()
  const [format, setFormat] = useState<"yaml" | "json" | "raw">("yaml")
  const [wordWrap, setWordWrap] = useState(false)
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const formatResult = (val: unknown, fmt: "yaml" | "json" | "raw"): string => {
    if (val === null || val === undefined) {
      return "null"
    }
    
    if (fmt === "raw") {
      return safeStringify(val)
    }
    
    try {
      if (fmt === "yaml") {
        return yamlStringify(val, { indent: 2 })
      } else {
        return safeStringify(val, 2)
      }
    } catch {
      return String(val)
    }
  }

  const resultContent = formatResult(value, format)

  // Editor will fill available space via flex layout

  const handleCopy = async () => {
    // Focus the editor, select all, copy, then unselect
    if (editorRef.current) {
      const editor = editorRef.current
      const model = editor.getModel()
      if (model) {
        editor.focus()
        const fullRange = model.getFullModelRange()
        editor.setSelection(fullRange)
        
        // Small delay to ensure selection is set
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Use Monaco's copy command which will copy the selected text
        const copyAction = editor.getAction("editor.action.clipboardCopyAction")
        if (copyAction) {
          await copyAction.run()
          // Clear selection after copy
          editor.setSelection({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
          })
          setCopied(true)
          setTimeout(() => setCopied(false), 1000)
          toast.success("Copied to clipboard")
          return
        }
      }
    }
    
    // Fallback to utility function if Monaco copy doesn't work
    const success = await copyToClipboard(resultContent)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      toast.success("Copied to clipboard")
    } else {
      toast.error("Failed to copy to clipboard")
    }
  }

  const editorTheme = theme === "dark" ? "vs-dark" : "light"

  return (
    <div className={`${className || ""} h-full flex flex-col min-h-0`}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as "yaml" | "json" | "raw")}
            className="flex items-center gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yaml" id="renderer-yaml" />
              <Label htmlFor="renderer-yaml" className="text-sm font-normal cursor-pointer">
                YAML
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="json" id="renderer-json" />
              <Label htmlFor="renderer-json" className="text-sm font-normal cursor-pointer">
                JSON
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="raw" id="renderer-raw" />
              <Label htmlFor="renderer-raw" className="text-sm font-normal cursor-pointer">
                RAW
              </Label>
            </div>
          </RadioGroup>
          <div style={{ width: 40 }} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={wordWrap ? "default" : "outline"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setWordWrap(!wordWrap)}
              >
                <WrapText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {wordWrap ? "Disable word wrap" : "Enable word wrap"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="border rounded-md overflow-hidden flex-1 min-h-0" style={{ minHeight: 0 }}>
        <Editor
          height="100%"
          language={format === "raw" ? "plaintext" : format}
          theme={editorTheme}
          value={resultContent}
          onMount={(editor) => {
            editorRef.current = editor
          }}
          options={{
            readOnly: true,
            wordWrap: wordWrap ? "on" : "off",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "off",
            folding: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}

