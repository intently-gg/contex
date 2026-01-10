import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WrapText, Copy, Check } from "lucide-react"
import Editor from "@monaco-editor/react"
import { stringify as yamlStringify } from "yaml"
import { safeStringify, copyToClipboard } from "@/lib/utils"

/**
 * Serialize array without quoting numbers/BigInts (for RAW format)
 */
function serializeArrayWithoutQuotingNumbers(arr: unknown[]): string {
  const items = arr.map((item) => {
    if (typeof item === "bigint") {
      return item.toString()
    }
    if (typeof item === "number") {
      return item.toString()
    }
    if (typeof item === "boolean") {
      return item.toString()
    }
    if (item === null) {
      return "null"
    }
    if (Array.isArray(item)) {
      return serializeArrayWithoutQuotingNumbers(item)
    }
    // For strings and other types, use JSON.stringify to get proper quoting
    return JSON.stringify(item)
  })
  return `[${items.join(",")}]`
}
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

  const formatResult = (val: unknown, fmt: "yaml" | "json" | "raw"): string => {
    if (val === null || val === undefined) {
      return "null"
    }
    
    if (fmt === "raw") {
      // For arrays, use custom serializer that doesn't quote numbers
      if (Array.isArray(val)) {
        return serializeArrayWithoutQuotingNumbers(val)
      }
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

  // Calculate Monaco editor height (max 15 lines, min 65px)
  const editorHeight = useMemo(() => {
    const lines = resultContent.split("\n").length
    const lineHeight = 19 // Monaco default line height
    const maxLines = 15
    const calculatedHeight = Math.min(lines, maxLines) * lineHeight
    return `${Math.max(calculatedHeight, 65)}px`
  }, [resultContent, wordWrap])

  const handleCopy = async () => {
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
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
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
      <div className="border rounded-md overflow-hidden" style={{ height: editorHeight }}>
        <Editor
          height={editorHeight}
          language={format === "raw" ? "plaintext" : format}
          theme={editorTheme}
          value={resultContent}
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

