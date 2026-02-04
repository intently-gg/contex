import { useState, useMemo, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { DEFAULT_REGISTERED_ADDRESSES, type RegisteredAddress } from "@/lib/config"

interface AddressHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  fieldType: "address" | "bytes32"
  chainId: number
}

function addressToBytes32(address: string): string {
  const normalized = address.startsWith("0x") ? address.slice(2) : address
  if (normalized.length !== 40) {
    throw new Error("Invalid address length")
  }
  return "0x" + normalized.toLowerCase().padStart(64, "0")
}

function normalizeHexInput(input: string): { hex: string; has0x: boolean } {
  const trimmed = input.trim()
  const has0x = trimmed.startsWith("0x") || trimmed.startsWith("0X")
  const hex = has0x ? trimmed.slice(2) : trimmed
  return { hex: hex.toLowerCase(), has0x }
}

function validateHexInput(hex: string): { valid: boolean; error?: string } {
  if (!/^[0-9a-f]*$/i.test(hex)) {
    return { valid: false, error: "Invalid hex characters" }
  }
  if (hex.length > 64) {
    return { valid: false, error: "Max 32 bytes (64 hex characters)" }
  }
  return { valid: true }
}

function hexToBytes32(hex: string): string {
  return "0x" + hex.padStart(64, "0")
}

export function AddressHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName: _fieldName,
  fieldType,
  chainId,
}: AddressHelperModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [customHexInput, setCustomHexInput] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearchQuery("")
      setCustomHexInput("")
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [open])

  const filteredAssets = useMemo(() => {
    const chainFiltered = DEFAULT_REGISTERED_ADDRESSES.filter((asset) => {
      if (asset.chainIds === "ALL") return true
      return asset.chainIds.includes(chainId)
    })

    if (!searchQuery.trim()) return chainFiltered

    const query = searchQuery.toLowerCase()
    return chainFiltered.filter((asset) => {
      return (
        asset.label.toLowerCase().includes(query) ||
        asset.address.toLowerCase().includes(query)
      )
    })
  }, [chainId, searchQuery])

  const groupedAssets = useMemo(() => {
    const groups: Record<string, RegisteredAddress[]> = {}
    filteredAssets.forEach((asset) => {
      if (!groups[asset.type]) {
        groups[asset.type] = []
      }
      groups[asset.type].push(asset)
    })

    Object.keys(groups).forEach((type) => {
      groups[type].sort((a, b) => a.label.localeCompare(b.label))
    })

    const sortedTypes = Object.keys(groups).sort()
    const result: Array<{ type: string; assets: RegisteredAddress[] }> = []
    sortedTypes.forEach((type) => {
      result.push({ type, assets: groups[type] })
    })

    return result
  }, [filteredAssets])

  const handleSelectAddress = (address: string) => {
    if (fieldType === "address") {
      onApply(address)
    } else {
      try {
        const bytes32 = addressToBytes32(address)
        onApply(bytes32)
      } catch {
        return
      }
    }
    onOpenChange(false)
  }

  const customHexValidation = useMemo(() => {
    if (!customHexInput.trim()) {
      return { valid: true, error: undefined, preview: undefined }
    }
    const { hex } = normalizeHexInput(customHexInput)
    const validation = validateHexInput(hex)
    if (!validation.valid) {
      return { valid: false, error: validation.error, preview: undefined }
    }
    const preview = hexToBytes32(hex)
    return { valid: true, error: undefined, preview }
  }, [customHexInput])

  const handleCustomHexApply = () => {
    if (customHexValidation.valid && customHexValidation.preview) {
      onApply(customHexValidation.preview)
      onOpenChange(false)
    }
  }

  const isBytes32 = fieldType === "bytes32"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isBytes32 ? "max-w-5xl" : "max-w-4xl"} max-h-[80vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle>Address Helper</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-2">Select an address to use from the list below</p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by label or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md p-2">
          {groupedAssets.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "No addresses found matching your search" : "No addresses available for this chain"}
            </div>
          ) : (
            <div className="space-y-2">
              {groupedAssets.map(({ type, assets }) => (
                <div key={type} className="space-y-0.5">
                  <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded">
                    <span className="font-semibold text-sm">{type}</span>
                  </div>

                  <div className="ml-2 space-y-0.5">
                    {assets.map((asset, index) => (
                      <Button
                        key={`${type}-${index}`}
                        type="button"
                        variant="outline"
                        onClick={() => handleSelectAddress(asset.address)}
                        className="w-full h-auto justify-start py-1.5 px-2 font-normal"
                      >
                        <span className="w-[100px] shrink-0 text-sm font-medium text-right truncate">
                          {asset.label}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate font-mono text-left">
                          {asset.address}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isBytes32 && (
          <>
            <div className="border-t border-border my-2 shrink-0" />
            <div className="space-y-2 shrink-0">
              <label className="text-sm font-medium">OR Input your own hex value</label>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="0x... or hex without 0x"
                    value={customHexInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        setCustomHexInput("")
                        return
                      }
                      const trimmed = val.trim()
                      const has0x = trimmed.startsWith("0x") || trimmed.startsWith("0X")
                      const hexPart = has0x ? trimmed.slice(2) : trimmed
                      if (/^[0-9a-f]*$/i.test(hexPart) && hexPart.length <= 64) {
                        setCustomHexInput(val)
                      } else if (val.length < customHexInput.length) {
                        setCustomHexInput(val)
                      }
                    }}
                    className="font-mono"
                  />
                  {customHexInput && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        {customHexValidation.error ? (
                          <div className="text-sm text-destructive">{customHexValidation.error}</div>
                        ) : customHexValidation.preview ? (
                          <div className="text-sm font-mono text-muted-foreground">
                            Preview: {customHexValidation.preview}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        onClick={handleCustomHexApply}
                        disabled={!customHexValidation.valid || !customHexValidation.preview}
                        size="sm"
                      >
                        OK
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
