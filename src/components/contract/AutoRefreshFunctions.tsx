import { useMemo, useEffect } from "react"
import { useReadContractFunction } from "@/hooks/useContractFunctions"
import { parseABI } from "@/lib/abiParser"
import type { Address, Abi } from "viem"

interface AutoRefreshFunctionsProps {
  contractLabel: string
  address: Address
  abi: Abi
  refreshKey?: number
}

/**
 * Hidden component that renders all ReadFunction components for functions with no params.
 * This ensures all such functions receive refreshKey and can auto-refresh.
 * These components are rendered but not displayed (hidden).
 */
export function AutoRefreshFunctions({
  contractLabel,
  address,
  abi,
  refreshKey,
}: AutoRefreshFunctionsProps) {
  // Get all read functions with no parameters
  const allFunctions = useMemo(() => parseABI(abi), [abi])
  const readFunctionsWithNoParams = useMemo(
    () => allFunctions.filter((f) => f.type === "read" && f.inputs.length === 0),
    [allFunctions]
  )

  // Render each function component (hidden) so they can receive refreshKey and auto-refresh
  return (
    <div style={{ display: "none" }}>
      {readFunctionsWithNoParams.map((func) => (
        <AutoRefreshFunction
          key={func.name}
          contractLabel={contractLabel}
          address={address}
          abi={abi}
          functionName={func.name}
          refreshKey={refreshKey}
        />
      ))}
    </div>
  )
}

interface AutoRefreshFunctionProps {
  contractLabel: string
  address: Address
  abi: Abi
  functionName: string
  refreshKey?: number
}

function AutoRefreshFunction({
  contractLabel,
  address,
  abi,
  functionName,
  refreshKey,
}: AutoRefreshFunctionProps) {
  // Enable query only when refreshKey is set (and > 0)
  // When component remounts (due to key change), this will be true and query will run
  const shouldAutoRefresh = refreshKey !== undefined && refreshKey > 0

  const { refetch } = useReadContractFunction(
    address,
    abi,
    functionName,
    [], // No args for functions with no params
    contractLabel,
    shouldAutoRefresh
  )

  // Trigger refetch when refreshKey changes OR when component first mounts
  // The key prop ensures component remounts when address changes, so this will run
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      // Small delay to ensure cache is cleared first
      const timer = setTimeout(() => {
        console.debug('[AutoRefreshFunction] Attempting to auto-refresh value', {
          contractLabel,
          functionName,
          address,
          refreshKey,
        })
        refetch()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [refreshKey, refetch, contractLabel, functionName, address])

  // Also trigger on mount (when address changes, component remounts due to key)
  useEffect(() => {
    if (shouldAutoRefresh) {
      const timer = setTimeout(() => {
        console.debug('[AutoRefreshFunction] Attempting to auto-refresh value (on mount)', {
          contractLabel,
          functionName,
          address,
          refreshKey,
        })
        refetch()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoRefresh, refetch, contractLabel, functionName, address, refreshKey])

  return null // This component doesn't render anything visible
}

