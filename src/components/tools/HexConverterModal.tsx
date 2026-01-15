import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Copy, Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

interface HexConverterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function normalizeHex(input: string): string {
  let value = input.trim()
  if (value.startsWith("0x") || value.startsWith("0X")) {
    value = value.slice(2)
  }
  return value.toLowerCase()
}

function filterHexInput(input: string): string {
  const trimmed = input.trim()
  const hasPrefix = trimmed.startsWith("0x") || trimmed.startsWith("0X")
  const withoutPrefix = hasPrefix ? trimmed.slice(2) : trimmed
  const filtered = withoutPrefix.replace(/[^0-9a-fA-F]/g, "")
  return hasPrefix ? `${trimmed.slice(0, 2)}${filtered}` : filtered
}

function hexToUint(hexInput: string): string | null {
  const hex = normalizeHex(hexInput)
  if (!hex) return null
  try {
    const value = BigInt(`0x${hex}`)
    return value.toString(10)
  } catch {
    return null
  }
}

function hexToString(hexInput: string): string | null {
  const hex = normalizeHex(hexInput)
  if (!hex) return null
  if (hex.length % 2 !== 0) {
    return null
  }
  try {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      const byte = Number.parseInt(hex.slice(i, i + 2), 16)
      if (Number.isNaN(byte)) {
        return null
      }
      bytes[i / 2] = byte
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  } catch {
    return null
  }
}

function hexToInt(hexInput: string): string | null {
  const hex = normalizeHex(hexInput)
  if (!hex) return null

  try {
    // Interpret as two's complement signed integer using the minimal width implied by the hex length
    const value = BigInt(`0x${hex}`)
    const totalBits = BigInt(hex.length * 4)
    if (totalBits === 0n) return null
    const signBit = BigInt(1) << (totalBits - 1n)
    const fullRange = BigInt(1) << totalBits

    const signed = (value & signBit) !== 0n ? value - fullRange : value
    return signed.toString(10)
  } catch {
    return null
  }
}

function uintToHex(uintInput: string): string | null {
  const trimmed = uintInput.trim()
  if (!trimmed) return null
  try {
    const value = BigInt(trimmed)
    if (value < 0n) return null
    // Return minimal hex without 0x prefix
    return value.toString(16)
  } catch {
    return null
  }
}

function intToHex(intInput: string): string | null {
  const trimmed = intInput.trim()
  if (!trimmed) return null
  try {
    const value = BigInt(trimmed)
    if (value === 0n) return "00"

    if (value > 0n) {
      // Positive: minimal hex, pad to even length for full bytes
      let hex = value.toString(16)
      if (hex.length % 2 !== 0) {
        hex = `0${hex}`
      }
      return hex
    }

    // Negative: choose minimal byte width n so that value fits in range [-2^(8n-1), 2^(8n-1)-1]
    const abs = -value
    let bits = 1n
    while ((BigInt(1) << (bits - 1n)) - BigInt(1) < abs) {
      bits += 1n
    }
    // Round bits up to full bytes
    const totalBits = ((bits + 7n) / 8n) * 8n
    const totalBytes = Number(totalBits / 8n)
    const fullRange = BigInt(1) << totalBits
    const twoComplement = fullRange + value
    let hex = twoComplement.toString(16)
    const targetLength = totalBytes * 2
    if (hex.length < targetLength) {
      hex = hex.padStart(targetLength, "0")
    }
    return hex
  } catch {
    return null
  }
}

function stringToHex(str: string): string | null {
  if (!str) return null
  try {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)
    let hex = ""
    for (const b of bytes) {
      hex += b.toString(16).padStart(2, "0")
    }
    return hex
  } catch {
    return null
  }
}

export function HexConverterModal({ open, onOpenChange }: HexConverterModalProps) {
  const [hexInput, setHexInput] = useState("")
  const [hexResult, setHexResult] = useState("")
  const [intInput, setIntInput] = useState("")
  const [intResult, setIntResult] = useState("")

  const [uintInput, setUintInput] = useState("")
  const [uintResult, setUintResult] = useState("")

  const [stringInput, setStringInput] = useState("")
  const [stringResult, setStringResult] = useState("")

  const [copied, setCopied] = useState(false)
  const hexResultRef = useRef<HTMLDivElement | null>(null)
  const intResultRef = useRef<HTMLDivElement | null>(null)
  const uintResultRef = useRef<HTMLDivElement | null>(null)
  const stringResultRef = useRef<HTMLDivElement | null>(null)

  const handleCopyFromRef = (node: HTMLDivElement | null) => {
    if (!node) {
      toast.error("Nothing to copy")
      return
    }

    const text = node.textContent ?? ""
    if (!text.trim()) {
      toast.error("Nothing to copy")
      return
    }

    try {
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      const successful = document.execCommand("copy")
      if (selection) {
        selection.removeAllRanges()
      }
      if (successful) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
        toast.success("Copied to clipboard")
      } else {
        toast.error("Failed to copy. Please select and copy manually.")
      }
    } catch {
      toast.error("Failed to copy. Please select and copy manually.")
    }
  }

  const handleHexToUint = () => {
    const filtered = filterHexInput(hexInput)
    setHexInput(filtered)
    const result = hexToUint(filtered)
    if (result === null) {
      setHexResult("")
      toast.error("Invalid hex for uint conversion")
      return
    }
    setHexResult(result)
  }

  const handleHexToInt = () => {
    const filtered = filterHexInput(hexInput)
    setHexInput(filtered)
    const result = hexToInt(filtered)
    if (result === null) {
      setHexResult("")
      toast.error("Invalid hex for int conversion")
      return
    }
    setHexResult(result)
  }

  const handleHexToString = () => {
    const filtered = filterHexInput(hexInput)
    setHexInput(filtered)
    const result = hexToString(filtered)
    if (result === null) {
      setHexResult("")
      toast.error("Invalid hex for string conversion")
      return
    }
    setHexResult(result)
  }

  const handleIntToHex = () => {
    const result = intToHex(intInput)
    if (result === null) {
      setIntResult("")
      return
    }
    setIntResult(result)
  }

  const handleUintToHex = () => {
    const filtered = uintInput.replace(/[^0-9]/g, "")
    setUintInput(filtered)
    const result = uintToHex(filtered)
    if (result === null) {
      setUintResult("")
      return
    }
    setUintResult(result)
  }

  const handleStringToHex = () => {
    const result = stringToHex(stringInput)
    if (result === null) {
      setStringResult("")
      return
    }
    setStringResult(result)
  }

  const clearAll = () => {
    setHexInput("")
    setHexResult("")
    setIntInput("")
    setIntResult("")
    setUintInput("")
    setUintResult("")
    setStringInput("")
    setStringResult("")
    setCopied(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          clearAll()
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-2xl min-h-[50vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Hex Converter</DialogTitle>
          <DialogDescription>
            Convert between hex bytes, signed/unsigned integers, and UTF-8 strings.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex-1 flex flex-col min-h-0">
          <Tabs defaultValue="from-hex" className="flex flex-col h-full">
            <div className="flex flex-col flex-1 pt-2">
              <TabsList>
                <TabsTrigger value="from-hex">From Hex</TabsTrigger>
                <TabsTrigger value="from-int">From Int</TabsTrigger>
                <TabsTrigger value="from-uint">From Uint</TabsTrigger>
                <TabsTrigger value="from-string">From UTF-8 String</TabsTrigger>
              </TabsList>
              <div className="flex-1 mt-3">
                <TabsContent value="from-hex" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="hex-input">Hex Bytes</Label>
                    <Textarea
                      id="hex-input"
                      value={hexInput}
                      onChange={(e) => setHexInput(filterHexInput(e.target.value))}
                      placeholder="0x48656c6c6f"
                      className="font-mono min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Input will be filtered to valid hex bytes. Optional 0x prefix is supported.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleHexToUint}>
                      To Uint
                    </Button>
                    <Button size="sm" onClick={handleHexToInt}>
                      To Int
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleHexToString}>
                      To UTF-8 String
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <div className="flex items-center gap-2">
                      <div
                        ref={hexResultRef}
                        className="flex-1 rounded-md bg-muted p-3 text-sm border font-mono min-h-[42px]"
                      >
                        {hexResult ? (
                          <span>{hexResult}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Run a conversion to see the result
                          </span>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => handleCopyFromRef(hexResultRef.current)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="from-int" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="int-input">Int (Signed Integer)</Label>
                    <Input
                      id="int-input"
                      value={intInput}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "" || /^-?\d*$/.test(val)) {
                          setIntInput(val)
                        }
                      }}
                      placeholder="-42 or 42"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Input accepts signed integers (can be negative). Interpreted as int256.
                    </p>
                  </div>
                  <div>
                    <Button size="sm" onClick={handleIntToHex}>
                      To Hex
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <div className="flex items-center gap-2">
                      <div
                        ref={intResultRef}
                        className="flex-1 rounded-md bg-muted p-3 text-sm border font-mono min-h-[42px]"
                      >
                        {intResult ? (
                          <span>{intResult}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Run a conversion to see the result
                          </span>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => handleCopyFromRef(intResultRef.current)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="from-uint" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="uint-input">Uint (Unsigned Integer)</Label>
                    <Input
                      id="uint-input"
                      value={uintInput}
                      onChange={(e) =>
                        setUintInput(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="255"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Input is filtered to digits only and interpreted as an unsigned integer (uint256).
                    </p>
                  </div>
                  <div>
                    <Button size="sm" onClick={handleUintToHex}>
                      To Hex
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <div className="flex items-center gap-2">
                      <div
                        ref={uintResultRef}
                        className="flex-1 rounded-md bg-muted p-3 text-sm border font-mono min-h-[42px]"
                      >
                        {uintResult ? (
                          <span>{uintResult}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Run a conversion to see the result
                          </span>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => handleCopyFromRef(uintResultRef.current)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="from-string" className="space-y-4 min-h-full">
                  <div className="space-y-2">
                    <Label htmlFor="string-input">UTF-8 String</Label>
                    <Textarea
                      id="string-input"
                      value={stringInput}
                      onChange={(e) => setStringInput(e.target.value)}
                      placeholder="Hello"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div>
                    <Button size="sm" onClick={handleStringToHex}>
                      To Hex
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <div className="flex items-center gap-2">
                      <div
                        ref={stringResultRef}
                        className="flex-1 rounded-md bg-muted p-3 text-sm border font-mono min-h-[42px]"
                      >
                        {stringResult ? (
                          <span>{stringResult}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Run a conversion to see the result
                          </span>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => handleCopyFromRef(stringResultRef.current)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}


