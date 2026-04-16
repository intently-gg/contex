import { useEffect, useMemo, useRef } from "react"
import { useChainId, usePublicClient } from "wagmi"
import { parseABI } from "@/lib/abiParser"
import { useContractStore } from "@/stores/contractStore"
import type { Address, Abi } from "viem"

interface AutoRefreshFunctionsProps {
  abiKey: string
  address: Address
  abi: Abi
  refreshKey?: number
}

const MULTICALL_CHUNK = 128

/**
 * When refreshKey bumps (contract / chain / wallet change), batch-reads all
 * zero-arg view/pure functions via Multicall3 and writes results under each
 * function's selector id — the same key FunctionSidebar and ReadFunction use.
 */
export function AutoRefreshFunctions({
  abiKey,
  address,
  abi,
  refreshKey,
}: AutoRefreshFunctionsProps) {
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const setReadResult = useContractStore((s) => s.setReadResult)

  const allFunctions = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed || []
  }, [abi])

  const readFunctionsWithNoParams = useMemo(
    () => allFunctions.filter((f) => f.type === "read" && f.inputs.length === 0),
    [allFunctions]
  )

  const runIdRef = useRef(0)

  useEffect(() => {
    if (refreshKey === undefined || refreshKey <= 0) return
    if (!publicClient || !address || !abiKey) return
    if (readFunctionsWithNoParams.length === 0) return

    const runId = ++runIdRef.current
    let cancelled = false

    const run = async () => {
      const contracts = readFunctionsWithNoParams.map((f) => ({
        address,
        abi: abi as Abi,
        functionName: f.name,
      }))

      type McResult =
        | { status: "success"; result?: unknown }
        | { status: "failure"; error?: Error }

      let flatResults: McResult[]

      try {
        flatResults = []
        for (let i = 0; i < contracts.length; i += MULTICALL_CHUNK) {
          const chunk = contracts.slice(i, i + MULTICALL_CHUNK)
          const part = await publicClient.multicall({
            contracts: chunk,
            allowFailure: true,
          })
          flatResults.push(...part)
        }
      } catch (err) {
        console.error("[AutoRefreshFunctions] multicall failed, falling back to readContract", err)
        flatResults = await Promise.all(
          readFunctionsWithNoParams.map(async (f) => {
            try {
              const result = await publicClient.readContract({
                address,
                abi: abi as Abi,
                functionName: f.name,
              })
              return { status: "success" as const, result }
            } catch (e) {
              return {
                status: "failure" as const,
                error: e instanceof Error ? e : new Error(String(e)),
              }
            }
          })
        )
      }

      if (cancelled || runId !== runIdRef.current) return

      for (let i = 0; i < readFunctionsWithNoParams.length; i++) {
        const func = readFunctionsWithNoParams[i]
        const r = flatResults[i]
        if (r?.status === "success" && r.result !== undefined) {
          setReadResult(abiKey, chainId, func.functionId, address, r.result)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    refreshKey,
    address,
    abi,
    abiKey,
    chainId,
    publicClient,
    readFunctionsWithNoParams,
    setReadResult,
  ])

  return null
}
