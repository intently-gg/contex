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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { useChainId } from "wagmi"
import { isAddress } from "viem"
import { Loader2 } from "lucide-react"

interface FetchABIModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onABIFetched: (abi: unknown[]) => void
}

export function FetchABIModal({
  open,
  onOpenChange,
  onABIFetched,
}: FetchABIModalProps) {
  const chainId = useChainId()
  const [fetchMode, setFetchMode] = useState<"etherscan" | "custom">("etherscan")
  const [contractAddress, setContractAddress] = useState("")
  const [selectedChainId, setSelectedChainId] = useState<string>("")
  const [customUrl, setCustomUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setFetchMode("etherscan")
      setContractAddress("")
      setCustomUrl("")
      setSelectedChainId(chainId ? String(chainId) : "1")
    }
  }, [open, chainId])

  const validateEtherscanInputs = (): boolean => {
    if (!contractAddress.trim()) {
      toast.error("Contract address is required")
      return false
    }

    const cleaned = contractAddress.trim()
    if (!isAddress(cleaned, { strict: false })) {
      toast.error("Invalid contract address", {
        description: "Please enter a valid Ethereum address",
      })
      return false
    }

    if (!selectedChainId || isNaN(Number(selectedChainId))) {
      toast.error("Invalid chain ID", {
        description: "Please enter a valid chain ID",
      })
      return false
    }

    return true
  }

  const validateCustomUrl = (): boolean => {
    if (!customUrl.trim()) {
      toast.error("URL is required")
      return false
    }

    try {
      new URL(customUrl.trim())
      return true
    } catch {
      toast.error("Invalid URL", {
        description: "Please enter a valid URL",
      })
      return false
    }
  }

  const handleFetch = async () => {
    if (fetchMode === "etherscan") {
      if (!validateEtherscanInputs()) {
        return
      }
    } else {
      if (!validateCustomUrl()) {
        return
      }
    }

    setIsLoading(true)

    try {
      const body: { url?: string; address?: string; chainId?: number } = {}
      
      if (fetchMode === "etherscan") {
        body.address = contractAddress.trim()
        body.chainId = Number(selectedChainId)
      } else {
        body.url = customUrl.trim()
      }

      const response = await fetch("/api/fetch-abi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const errorMsg = errorData.error || `HTTP error! status: ${response.status}`
        throw new Error(errorMsg)
      }

      const data = await response.json()

      if (!data.success || !data.abi) {
        throw new Error("Failed to parse ABI from response")
      }

      if (!Array.isArray(data.abi)) {
        throw new Error("ABI must be an array")
      }

      onABIFetched(data.abi)
      onOpenChange(false)
      toast.success("ABI fetched successfully")
    } catch (error) {
      toast.error(
        <>
          Failed to fetch ABI.<br />Please double-check the input parameters.<br /><br />Err Code:
        </>,
      {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fetch from URL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup
            value={fetchMode}
            onValueChange={(value) => setFetchMode(value as "etherscan" | "custom")}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="etherscan" id="fetch-etherscan" />
              <Label htmlFor="fetch-etherscan" className="cursor-pointer">
                Fetch from{" "}
                <a
                  href="https://etherscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  Etherscan
                </a>
                :
              </Label>
            </div>
            {fetchMode === "etherscan" && (
              <div className="ml-6 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="contract-address">Contract Address</Label>
                  <Input
                    id="contract-address"
                    placeholder="0x..."
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chain-id">Chain ID</Label>
                  <Input
                    id="chain-id"
                    type="number"
                    placeholder="1"
                    value={selectedChainId}
                    onChange={(e) => setSelectedChainId(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="fetch-custom" />
              <Label htmlFor="fetch-custom" className="cursor-pointer">
                Custom URL
              </Label>
            </div>
            {fetchMode === "custom" && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="custom-url">URL *</Label>
                <Input
                  id="custom-url"
                  placeholder="https://..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleFetch} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

