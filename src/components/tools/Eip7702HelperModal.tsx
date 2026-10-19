import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAccount, useChainId, useChains, usePublicClient, useSwitchChain } from "wagmi"
import { getWalletClient } from "wagmi/actions"
import { config, DEFAULT_CHAIN_ICON } from "@/lib/wagmi"
import {
  BaseError,
  UserRejectedRequestError,
  getAddress,
  isAddress,
  isAddressEqual,
  numberToHex,
  zeroAddress,
  type Address,
  type Hex,
  type SignedAuthorization,
} from "viem"
import { getDelegation, prepareAuthorization } from "viem/actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface Eip7702HelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DELEGATION_PREFIX = "0xef0100"

function isEip7702Designator(code: string | undefined): boolean {
  // Designator is exactly 3 prefix bytes + a 20-byte address.
  return !!code && code.length === 48 && code.toLowerCase().startsWith(DELEGATION_PREFIX)
}

function errorText(error: unknown): string {
  if (error instanceof BaseError) {
    return `${error.shortMessage}\n${error.message}\n${error.details ?? ""}`
  }
  if (error instanceof Error) return error.message
  return String(error ?? "")
}

function isUserRejection(error: unknown): boolean {
  if (error instanceof BaseError && error.walk((err) => err instanceof UserRejectedRequestError)) {
    return true
  }
  const code = (error as { code?: number } | null)?.code
  return code === 4001 || /user rejected|user denied|user cancelled|user canceled/i.test(errorText(error))
}

function isJsonRpcAuthUnsupported(error: unknown): boolean {
  return /does not support json-rpc/i.test(errorText(error))
}

function isMethodMissing(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code
  const text = errorText(error).toLowerCase()
  return (
    code === -32601 ||
    text.includes("method not found") ||
    text.includes("does not exist") ||
    text.includes("is not available") ||
    text.includes("unsupported method")
  )
}

function formatActionError(error: unknown): string {
  if (isUserRejection(error)) return "Request rejected in wallet"
  const text = error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : "Delegation failed"
  if (/external eip-7702|eip-7702 .*not supported|not support 7702/i.test(errorText(error))) {
    return `This wallet cannot sign an EIP-7702 delegation from a dapp. ${text}`
  }
  return text
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "bigint" || typeof value === "number") return Number(value)
  if (typeof value === "string" && value.trim()) return Number(value)
  return fallback
}

function asHex(value: unknown): Hex {
  if (typeof value === "bigint") return numberToHex(value)
  if (typeof value === "string" && value.startsWith("0x")) return value as Hex
  throw new Error("Wallet returned an authorization without a signature")
}

function authorizationFromWallet(
  raw: unknown,
  fallback: { address: Address; chainId: number; nonce: number }
): SignedAuthorization {
  if (typeof raw === "string" && /^0x[0-9a-fA-F]{130}$/.test(raw)) {
    const yParityRaw = Number.parseInt(raw.slice(130, 132), 16)
    return {
      address: fallback.address,
      chainId: fallback.chainId,
      nonce: fallback.nonce,
      r: `0x${raw.slice(2, 66)}`,
      s: `0x${raw.slice(66, 130)}`,
      yParity: yParityRaw >= 27 ? yParityRaw - 27 : yParityRaw,
    }
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Wallet returned an unrecognized authorization")
  }

  const record = raw as Record<string, unknown>
  const yParityRaw = asNumber(record.yParity ?? record.v, Number.NaN)
  if (!Number.isFinite(yParityRaw)) {
    throw new Error("Wallet returned an authorization without yParity")
  }

  return {
    address: getAddress((record.address ?? record.contractAddress ?? fallback.address) as string),
    chainId: asNumber(record.chainId, fallback.chainId),
    nonce: asNumber(record.nonce, fallback.nonce),
    r: asHex(record.r),
    s: asHex(record.s),
    yParity: yParityRaw >= 27 ? yParityRaw - 27 : yParityRaw,
  }
}

export function Eip7702HelperModal({ open, onOpenChange }: Eip7702HelperModalProps) {
  const { address, isConnected } = useAccount()
  const walletChainId = useChainId()
  const chains = useChains()
  const { switchChainAsync } = useSwitchChain()
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const publicClient = usePublicClient({ chainId: selectedChainId ?? undefined })

  const [delegation, setDelegation] = useState<Address | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [delegateInput, setDelegateInput] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [sendingMode, setSendingMode] = useState<"change" | "clear" | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  const [pendingDelegate, setPendingDelegate] = useState<Address | null>(null)

  const chainTouched = useRef(false)
  useEffect(() => {
    if (!open) {
      chainTouched.current = false
      return
    }
    if (!chainTouched.current) {
      setSelectedChainId(walletChainId)
    }
  }, [open, walletChainId])

  useEffect(() => {
    if (!open) return
    setDelegateInput("")
    setFormError(null)
    setWarningOpen(false)
    setPendingDelegate(null)
  }, [open])

  useEffect(() => {
    if (!open || !isConnected || !address || !selectedChainId || !publicClient) {
      setDelegation(null)
      setIsReading(false)
      setReadError(null)
      return
    }

    let cancelled = false
    setIsReading(true)
    setReadError(null)

    getDelegation(publicClient, { address })
      .then((delegated) => {
        if (cancelled) return
        if (!delegated || isAddressEqual(delegated, zeroAddress)) {
          setDelegation(null)
        } else {
          setDelegation(delegated)
        }
      })
      .catch((error) => {
        if (cancelled) return
        setDelegation(null)
        setReadError(error instanceof Error ? error.message : "Could not read delegation")
      })
      .finally(() => {
        if (!cancelled) setIsReading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, isConnected, address, selectedChainId, publicClient, reloadToken])

  const selectedChain = chains.find((chain) => chain.id === selectedChainId)
  const explorerBase = selectedChain?.blockExplorers?.default?.url
  const delegationUrl = delegation && explorerBase ? `${explorerBase}/address/${delegation}` : null
  const isSending = sendingMode !== null
  const busy = isChecking || isSending

  const fail = (message: string, toastMessage?: string) => {
    setFormError(message)
    toast.error(toastMessage ?? message)
  }

  const submitDelegation = async (delegate: Address) => {
    if (!address || !selectedChainId || !selectedChain || !publicClient) {
      fail("Connect a wallet and select a chain first")
      return
    }

    setSendingMode(isAddressEqual(delegate, zeroAddress) ? "clear" : "change")
    setFormError(null)

    try {
      if (walletChainId !== selectedChainId) {
        await switchChainAsync({ chainId: selectedChainId })
      }

      const walletClient = await getWalletClient(config, { chainId: selectedChainId })

      // The transaction itself consumes the account nonce, so the authorization
      // must be signed for nonce + 1 when this wallet also sends the transaction.
      const prepared = await prepareAuthorization(publicClient, {
        account: address,
        contractAddress: delegate,
        chainId: selectedChainId,
        executor: "self",
      })

      let authorization: SignedAuthorization | { address: Address; chainId: number; nonce: number } = {
        address: delegate,
        chainId: prepared.chainId,
        nonce: prepared.nonce,
      }

      // viem can only sign authorizations for local accounts. Connected wallets
      // are asked via wallet_signAuthorization, then via a type-4 transaction
      // that leaves the authorization signature for the wallet to fill in.
      let signed = false
      try {
        authorization = await walletClient.signAuthorization({
          account: address,
          contractAddress: delegate,
          chainId: prepared.chainId,
          nonce: prepared.nonce,
        })
        signed = true
      } catch (error) {
        if (isUserRejection(error) || !isJsonRpcAuthUnsupported(error)) throw error
      }

      if (!signed) {
        try {
          const request = walletClient.request as (args: {
            method: string
            params: readonly unknown[]
          }) => Promise<unknown>
          const raw = await request({
            method: "wallet_signAuthorization",
            params: [
              {
                contractAddress: delegate,
                address: delegate,
                from: address,
                chainId: numberToHex(selectedChainId),
                nonce: numberToHex(prepared.nonce),
              },
            ],
          })
          authorization = authorizationFromWallet(raw, {
            address: delegate,
            chainId: prepared.chainId,
            nonce: Number(prepared.nonce),
          })
          signed = true
        } catch (error) {
          if (isUserRejection(error) || !isMethodMissing(error)) throw error
        }
      }

      const hash = await walletClient.sendTransaction({
        account: address,
        chain: selectedChain,
        to: address,
        data: "0x",
        type: "eip7702",
        authorizationList: [authorization],
      })

      const txUrl = explorerBase ? `${explorerBase}/tx/${hash}` : null
      toast.success("Delegation submitted", {
        description: txUrl ? (
          <a href={txUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
            {hash}
          </a>
        ) : (
          hash
        ),
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === "reverted") {
        throw new Error("Delegation transaction reverted")
      }

      const updated = await getDelegation(publicClient, { address })
      const cleared = isAddressEqual(delegate, zeroAddress)
      const applied =
        !!updated && !isAddressEqual(updated, zeroAddress) && isAddressEqual(updated, delegate)
      if (cleared ? !!updated && !isAddressEqual(updated, zeroAddress) : !applied) {
        throw new Error(
          "The transaction confirmed, but the delegation did not change. This wallet may have dropped the EIP-7702 authorization."
        )
      }

      toast.success(cleared ? "Delegation cleared" : "Delegation updated")
      setDelegateInput("")
      setPendingDelegate(null)
      setReloadToken((token) => token + 1)
    } catch (error) {
      console.error("EIP-7702 delegation failed:", error)
      fail(formatActionError(error))
    } finally {
      setSendingMode(null)
    }
  }

  const handleChange = async () => {
    setFormError(null)

    if (!isConnected || !address) {
      fail("Connect a wallet first")
      return
    }
    if (!selectedChainId || !selectedChain || !publicClient) {
      fail("Chain selection required")
      return
    }

    const cleaned = delegateInput.trim()
    if (!cleaned || !isAddress(cleaned, { strict: false })) {
      fail("Enter a valid contract address")
      return
    }

    const delegate = getAddress(cleaned)
    if (isAddressEqual(delegate, zeroAddress)) {
      fail("Use Clear delegation to remove the current delegation")
      return
    }

    setIsChecking(true)
    try {
      const code = await publicClient.getCode({ address: delegate })
      if (!code || code === "0x") {
        fail(`No contract code is deployed at this address on ${selectedChain.name}`)
        return
      }
      if (isEip7702Designator(code)) {
        fail(
          "This address is only an EIP-7702 delegation, not a deployed contract. Delegation does not chain, so this account would run those designator bytes instead of the contract that address points to.",
          "That address is an EIP-7702 delegation, not a contract"
        )
        return
      }

      setPendingDelegate(delegate)
      setWarningOpen(true)
    } catch (error) {
      console.error("EIP-7702 code check failed:", error)
      fail(error instanceof Error ? error.message : "Could not read contract code")
    } finally {
      setIsChecking(false)
    }
  }

  const handleClear = () => {
    setFormError(null)
    if (!delegation) return
    void submitDelegation(zeroAddress)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl" style={{ backgroundColor: "hsl(var(--background))" }}>
          <DialogHeader>
            <DialogTitle>EIP-7702 Helper</DialogTitle>
            <DialogDescription>
              Delegation contract for the connected wallet on the selected chain.
            </DialogDescription>
          </DialogHeader>

          {!isConnected || !address ? (
            <p className="text-sm text-muted-foreground py-4">Connect a wallet to view or change its delegation.</p>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="eip7702-chain">Chain</Label>
                <Select
                  value={selectedChainId?.toString() || ""}
                  onValueChange={(value) => {
                    chainTouched.current = true
                    setSelectedChainId(Number(value))
                    setFormError(null)
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id="eip7702-chain">
                    <SelectValue placeholder="Select a chain" />
                  </SelectTrigger>
                  <SelectContent>
                    {chains.map((chain) => {
                      const iconUrl = (chain as { iconUrl?: string }).iconUrl || (chain.nativeCurrency as { iconUrl?: string }).iconUrl
                      const iconBackground = (chain as { iconBackground?: string }).iconBackground || "#d3d3d3"
                      return (
                        <SelectItem key={chain.id} value={chain.id.toString()}>
                          <div className="flex items-center gap-2">
                            <img
                              src={iconUrl || DEFAULT_CHAIN_ICON}
                              alt={chain.name}
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              onError={(event) => {
                                event.preventDefault()
                                const target = event.target as HTMLImageElement
                                if (target.src !== DEFAULT_CHAIN_ICON) {
                                  target.src = DEFAULT_CHAIN_ICON
                                }
                              }}
                              style={{ backgroundColor: iconBackground }}
                            />
                            <span>
                              {chain.name} (id: {chain.id})
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {selectedChainId !== null && selectedChainId !== walletChainId && (
                  <p className="text-xs text-muted-foreground">Submitting switches the wallet to this chain.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Wallet</Label>
                <p className="font-mono text-sm break-all">{address}</p>
              </div>

              <div className="space-y-2">
                <Label>Current delegation</Label>
                {isReading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : readError ? (
                  <p className="text-sm break-words" style={{ color: "#ec4899" }}>
                    {readError}
                  </p>
                ) : delegation ? (
                  delegationUrl ? (
                    <a
                      href={delegationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm break-all underline"
                    >
                      {delegation}
                    </a>
                  ) : (
                    <p className="font-mono text-sm break-all">{delegation}</p>
                  )
                ) : (
                  <p className="text-sm">No contract is currently delegated</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eip7702-delegate">Delegate address</Label>
                <Input
                  id="eip7702-delegate"
                  placeholder="0x..."
                  value={delegateInput}
                  onChange={(event) => setDelegateInput(event.target.value)}
                  className="font-mono"
                  disabled={busy}
                  spellCheck={false}
                />
                {formError && (
                  <div className="flex items-start gap-2 text-sm break-words" style={{ color: "#ec4899" }}>
                    <span className="flex-shrink-0 mt-0.5">×</span>
                    <span className="break-words">{formError}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={handleClear} disabled={busy || isReading || !delegation}>
                  {sendingMode === "clear" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirm in wallet
                    </>
                  ) : (
                    "Clear delegation"
                  )}
                </Button>
                <Button onClick={() => void handleChange()} disabled={busy || !delegateInput.trim()}>
                  {isChecking || sendingMode === "change" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isChecking ? "Checking..." : "Confirm in wallet"}
                    </>
                  ) : (
                    "Change EIP7702 Delegate"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delegate this account?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {`Delegating lets ${pendingDelegate ?? "this contract"} run as this wallet on ${selectedChain?.name ?? "the selected chain"}. It can move assets and call contracts in your name. Continue only if you trust that code. You can replace or clear it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelegate) void submitDelegation(pendingDelegate)
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
