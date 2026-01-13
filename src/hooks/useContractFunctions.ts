import React, { useEffect, useState } from "react"
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId, useChains } from "wagmi"
import type { Address, Abi } from "viem"
import { decodeErrorResult } from "viem"
import { useContractStore } from "@/stores/contractStore"
import { safeStringify } from "@/lib/utils"
import { toast } from "sonner"

export function useReadContractFunction(
  address: Address,
  abi: Abi,
  functionName: string,
  args: unknown[] = [],
  abiKey?: string,
  enabled: boolean = true
) {
  const chainId = useChainId()
  const { setReadResult, getReadResult } = useContractStore()

  // NEVER run query unless explicitly enabled
  // Disable all automatic refetching - we control it manually
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
      // Disable automatic refetching on any other triggers
      staleTime: Infinity,
      gcTime: Infinity,
    },
  })

  useEffect(() => {
    if (result.data !== undefined && abiKey) {
      const cached = getReadResult(abiKey, chainId, functionName, address)
      // Compare serialized values to avoid BigInt comparison issues
      const cachedStr = cached ? safeStringify(cached.value) : null
      const currentStr = safeStringify(result.data)
      if (!cached || cachedStr !== currentStr) {
        setReadResult(abiKey, chainId, functionName, address, result.data)
      }

    }
  }, [result.data, abiKey, chainId, functionName, address, getReadResult, setReadResult])

  return result
}

export function useWriteContractFunction(
  address: Address,
  abi: Abi,
  functionName: string
) {
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const publicClient = usePublicClient()
   const chainId = useChainId()
   const chains = useChains()
  const { 
    data: receipt, 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    isError: receiptError,
    error: receiptErrorData
  } = useWaitForTransactionReceipt({
    hash,
  })

  const [revertError, setRevertError] = useState<Error | null>(null)
  const [isPollingReceipt, setIsPollingReceipt] = useState(false)

  // Poll for receipt directly when we have a hash - don't wait for useWaitForTransactionReceipt
  useEffect(() => {
    if (!hash || !publicClient || isPollingReceipt || revertError) return
    
    let cancelled = false
    setIsPollingReceipt(true)
    
    const pollReceipt = async () => {
      try {
        // Poll for receipt with a short interval
        const checkReceipt = async (): Promise<void> => {
          if (cancelled) return
          
          try {
            const fetchedReceipt = await publicClient.getTransactionReceipt({ hash })
            
            if (cancelled) return
            
            const status = fetchedReceipt.status
            const isRevertedStatus = status === "reverted" || (typeof status === "number" && status === 0)
            const isSuccessStatus = status === "success" || (typeof status === "number" && status === 1)
            
            if (isRevertedStatus) {
              // Transaction reverted - extract revert reason
              let revertMessage = "Transaction reverted on-chain"
              
              try {
                const tx = await publicClient.getTransaction({ hash })
                // Try to simulate the call to get revert reason
                try {
                  await publicClient.call({
                    account: tx.from,
                    to: tx.to || address,
                    data: tx.input as `0x${string}`,
                    value: tx.value,
                  })
                } catch (callErr: any) {
                  // Extract revert reason from error
                  if (callErr?.data) {
                    try {
                      const decoded = decodeErrorResult({
                        data: callErr.data as `0x${string}`,
                        abi,
                      })
                      revertMessage = `Transaction reverted: ${decoded.errorName}${decoded.args && decoded.args.length > 0 ? ` (${decoded.args.join(", ")})` : ""}`
                    } catch {
                      if (callErr.message) {
                        const messageMatch = callErr.message.match(/revert\s+(.+?)(?:\n|$)/i) ||
                                            callErr.message.match(/execution reverted:\s*(.+?)(?:\n|$)/i)
                        if (messageMatch && messageMatch[1]) {
                          revertMessage = `Transaction reverted: ${messageMatch[1].trim()}`
                        } else {
                          revertMessage = `Transaction reverted: ${callErr.message}`
                        }
                      }
                    }
                  } else if (callErr.message) {
                    const messageMatch = callErr.message.match(/revert\s+(.+?)(?:\n|$)/i) ||
                                        callErr.message.match(/execution reverted:\s*(.+?)(?:\n|$)/i) ||
                                        callErr.message.match(/Execution reverted with reason:\s*(.+?)(?:\n|$)/i)
                    if (messageMatch && messageMatch[1]) {
                      revertMessage = `Transaction reverted: ${messageMatch[1].trim()}`
                    } else if (callErr.message.includes("revert")) {
                      revertMessage = `Transaction reverted: ${callErr.message}`
                    }
                  }
                }
              } catch {
                // If we can't get transaction or simulate, use generic message
              }
              
              const error = new Error(revertMessage)
              error.name = "TransactionReverted"
              setRevertError(error)
              setIsPollingReceipt(false)
            } else if (isSuccessStatus) {
              // Transaction succeeded - clear any revert error
              setRevertError(null)
              setIsPollingReceipt(false)
            }
          } catch (err: any) {
            // Receipt not available yet - retry after a short delay
            // Check if it's a "not found" error (receipt not available yet)
            const isNotFoundError = err?.name === "TransactionNotFoundError" || 
                                   err?.name === "NotFoundError" ||
                                   err?.message?.includes("not found") ||
                                   err?.message?.includes("Transaction not found")
            
            if (!cancelled) {
              if (isNotFoundError) {
                // Receipt not available yet - retry after 200ms (faster polling)
                setTimeout(() => {
                  if (!cancelled) {
                    checkReceipt()
                  }
                }, 200)
              } else {
                // Some other error - still retry but with longer delay
                setTimeout(() => {
                  if (!cancelled) {
                    checkReceipt()
                  }
                }, 1000)
              }
            }
          }
        }
        
        // Start polling immediately
        checkReceipt()
      } catch (err) {
        if (!cancelled) {
          setIsPollingReceipt(false)
        }
      }
    }
    
    pollReceipt()
    
    return () => {
      cancelled = true
      setIsPollingReceipt(false)
    }
  }, [hash, publicClient, address, abi, revertError])

  // Fallback: also check receiptError from useWaitForTransactionReceipt as backup
  // (but our polling should catch it first)
  useEffect(() => {
    if (receiptError && receiptErrorData && hash && !revertError) {
      let revertMessage = "Transaction reverted on-chain"
      
      // Extract revert reason from the error data
      const errorString = String(receiptErrorData)
      
      // Try to extract revert reason from error message
      const reasonMatch = errorString.match(/Execution reverted with reason:\s*(.+?)(?:\n|$)/i) ||
                         errorString.match(/Details:\s*execution reverted:\s*(.+?)(?:\n|$)/i) ||
                         errorString.match(/execution reverted:\s*(.+?)(?:\n|$)/i) ||
                         errorString.match(/revert\s+(.+?)(?:\n|$)/i)
      
      if (reasonMatch && reasonMatch[1]) {
        revertMessage = `Transaction reverted: ${reasonMatch[1].trim()}`
      }
      
      // Set the error (this is a fallback - polling should catch it first)
      const error = new Error(revertMessage)
      error.name = "TransactionReverted"
      setRevertError(error)
    }
  }, [receiptError, receiptErrorData, hash, revertError])

  // Reset revert error and polling state when hash changes (new transaction)
  useEffect(() => {
    if (hash) {
      setRevertError(null)
      setIsPollingReceipt(false)
    }
  }, [hash])

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
      const chain = chains.find((c) => c.id === chainId)
      const baseUrl = chain?.blockExplorers?.default?.url
      const explorerTxUrl = baseUrl ? `${baseUrl}/tx/${hash}` : null

      toast.success("Transaction submitted", {
        description: explorerTxUrl
          ? React.createElement(
              "a",
              {
                href: explorerTxUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                style: { textDecoration: "underline" },
              },
              `Hash: ${hash}`
            )
          : `Hash: ${hash}`,
      })
    }
  }, [hash, isPending, chains, chainId])

  useEffect(() => {
    if (isConfirmed && hash && receipt?.status === "success") {
      const chain = chains.find((c) => c.id === chainId)
      const baseUrl = chain?.blockExplorers?.default?.url
      const explorerTxUrl = baseUrl ? `${baseUrl}/tx/${hash}` : null

      toast.success("Transaction confirmed", {
        description: explorerTxUrl
          ? React.createElement(
              "a",
              {
                href: explorerTxUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                style: { textDecoration: "underline" },
              },
              `Hash: ${hash}`
            )
          : `Hash: ${hash}`,
      })
    }
  }, [isConfirmed, hash, receipt, chains, chainId])

  useEffect(() => {
    if (revertError && hash) {
      const chain = chains.find((c) => c.id === chainId)
      const baseUrl = chain?.blockExplorers?.default?.url
      const explorerTxUrl = baseUrl ? `${baseUrl}/tx/${hash}` : null

      toast.error("Transaction reverted", {
        description: explorerTxUrl
          ? React.createElement(
              "div",
              null,
              React.createElement("div", null, revertError.message),
              React.createElement(
                "a",
                {
                  href: explorerTxUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: { textDecoration: "underline", display: "block", marginTop: "4px" },
                },
                `Hash: ${hash}`
              )
            )
          : revertError.message,
      })
    }
  }, [revertError, hash, chains, chainId])

  // Combine error and revertError - revertError takes precedence
  const finalError = revertError || error

  // Determine if transaction is reverted
  const receiptStatus = receipt?.status
  const isReverted = !!revertError || 
                      receiptStatus === "reverted" || 
                      (typeof receiptStatus === "number" && receiptStatus === 0) ||
                      (receiptError && !isConfirming)

  return {
    write,
    hash,
    error: finalError,
    isPending,
    isConfirming: isConfirming || isPollingReceipt,
    isConfirmed: isConfirmed && receipt?.status === "success",
    isReverted,
    revertError,
  }
}


