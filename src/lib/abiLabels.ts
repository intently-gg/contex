import type { ABIEntry } from "@/stores/abiStore"

export function getABILabel(
  abis: Record<string, ABIEntry>,
  abiKey: string
): string {
  return abis[abiKey]?.label || abiKey
}

