import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useChains, useChainId } from "wagmi"
import { createPublicClient, http } from "viem"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { DEFAULT_CHAIN_ICON } from "@/lib/wagmi"

interface FetchTxModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCalldataFetched: (calldata: string) => void
}

export function FetchTxModal({
  open,
  onOpenChange,
  onCalldataFetched,
}: FetchTxModalProps) {
  const chains = useChains()
  const chainId = useChainId()
  const [txHash, setTxHash] = useState("")
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedChainId(chainId)
      setError(null)
    }
  }, [open, chainId])

  const validateTxHash = (hash: string): boolean => {
    const trimmed = hash.trim()
    if (!trimmed) return false
    const cleaned = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`
    return /^0x[0-9a-fA-F]{64}$/.test(cleaned)
  }

  const handleFetch = async () => {
    setError(null)

    if (!txHash.trim()) {
      toast.error("Transaction hash required")
      return
    }

    if (!validateTxHash(txHash)) {
      setError("Transaction hash must be a valid bytes32 (0x followed by 64 hex characters)")
      toast.error("Invalid transaction hash")
      return
    }

    if (!selectedChainId) {
      toast.error("Chain selection required")
      return
    }

    setIsLoading(true)

    try {
      const chain = chains.find((c) => c.id === selectedChainId)
      if (!chain) {
        throw new Error("Selected chain not found")
      }

      const client = createPublicClient({
        chain,
        transport: http(),
      })

      const normalizedHash = txHash.trim().startsWith("0x") ? txHash.trim() : `0x${txHash.trim()}`
      const tx = await client.getTransaction({ hash: normalizedHash as `0x${string}` })

      if (!tx.input || tx.input === "0x") {
        setError("This transaction does not contain any calldata bytes")
        toast.error("No calldata found")
        return
      }

      onCalldataFetched(tx.input)
      toast.success("Calldata fetched")
      onOpenChange(false)
      setTxHash("")
      setSelectedChainId(chainId)
      setError(null)
    } catch (error) {
      console.error("Error fetching transaction:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setError(errorMessage)
      toast.error("Fetch failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" style={{ maxWidth: 'calc(36rem + 100px)', backgroundColor: 'hsl(var(--background))' }}>
        <DialogHeader>
          <DialogTitle>Fetch from On-Chain Tx</DialogTitle>
          <DialogDescription>
            Enter a transaction hash and select a chain to fetch the calldata bytes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tx-hash">Transaction Hash</Label>
            <Input
              id="tx-hash"
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="font-mono"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chain-select">Chain</Label>
            <Select
              value={selectedChainId?.toString() || ""}
              onValueChange={(value) => setSelectedChainId(Number(value))}
              disabled={isLoading}
            >
              <SelectTrigger id="chain-select">
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => {
                  const iconUrl = (chain as any).iconUrl || ((chain.nativeCurrency as any)?.iconUrl)
                  const iconBackground = (chain as any).iconBackground || '#d3d3d3'
                  return (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      <div className="flex items-center gap-2">
                        <img
                          src={iconUrl || DEFAULT_CHAIN_ICON}
                          alt={chain.name}
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          onError={(e) => {
                            e.preventDefault()
                            const target = e.target as HTMLImageElement
                            if (target.src !== DEFAULT_CHAIN_ICON) {
                              target.src = DEFAULT_CHAIN_ICON
                            }
                          }}
                          style={{
                            backgroundColor: iconBackground,
                          }}
                        />
                        <span>{chain.name} (id: {chain.id})</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {error && (
              <div className="flex items-start gap-2 text-sm break-words" style={{ color: '#ec4899' }}>
                <span className="flex-shrink-0 mt-0.5">×</span>
                <span className="break-words">{error}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleFetch} disabled={isLoading || !txHash.trim() || !selectedChainId}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              "Fetch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

