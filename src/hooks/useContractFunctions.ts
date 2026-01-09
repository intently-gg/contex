import { useEffect } from "react"
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useChainId } from "wagmi"
import type { Address, Abi } from "viem"
import { useContractStore } from "@/stores/contractStore"
import { safeStringify } from "@/lib/utils"
import { toast } from "sonner"

export function useReadContractFunction(
  address: Address,
  abi: Abi,
  functionName: string,
  args: unknown[] = [],
  contractLabel?: string,
  enabled: boolean = true
) {
  const chainId = useChainId()
  const { setReadResult, getReadResult } = useContractStore()

  // NEVER run query unless explicitly enabled - even if args change
  const result = useReadContract({
    address,
    abi,
    functionName,
    args: args.length > 0 ? args : undefined,
    chainId,
    query: {
      enabled: enabled && address !== undefined,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  })

  useEffect(() => {
    if (result.data !== undefined && contractLabel) {
      const cached = getReadResult(contractLabel, chainId, functionName, address)
      // Compare serialized values to avoid BigInt comparison issues
      const cachedStr = cached ? safeStringify(cached.value) : null
      const currentStr = safeStringify(result.data)
      if (!cached || cachedStr !== currentStr) {
        setReadResult(contractLabel, chainId, functionName, address, result.data)
      }
    }
  }, [result.data, contractLabel, chainId, functionName, address, getReadResult, setReadResult])

  return result
}

export function useWriteContractFunction(
  address: Address,
  abi: Abi,
  functionName: string
) {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    })

  const write = async (args: unknown[], value?: bigint) => {
    try {
      await writeContract({
        address,
        abi,
        functionName,
        args,
        value,
      })
      // Don't show toast here - wait for hash to be available
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Transaction failed"
      toast.error("Transaction failed", {
        description: errorMessage,
      })
      throw err
    }
  }

  // Show toast only when hash is actually available (transaction successfully submitted)
  useEffect(() => {
    if (hash && !isPending) {
      toast.success("Transaction submitted", {
        description: `Hash: ${hash}`,
      })
    }
  }, [hash, isPending])

  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success("Transaction confirmed", {
        description: `Hash: ${hash}`,
      })
    }
  }, [isConfirmed, hash])

  return {
    write,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  }
}

