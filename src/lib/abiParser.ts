import type { Abi, AbiFunction } from "viem"

export interface ParsedFunction {
  name: string
  type: "read" | "write"
  inputs: AbiFunction["inputs"]
  outputs: AbiFunction["outputs"]
  stateMutability: AbiFunction["stateMutability"]
  abiFunction: AbiFunction
}

export function parseABI(abi: Abi): ParsedFunction[] | null {
  try {
    const functions: ParsedFunction[] = []

    for (const item of abi) {
      if (item.type === "function") {
        const isRead =
          item.stateMutability === "view" || item.stateMutability === "pure"
        const isWrite =
          item.stateMutability === "nonpayable" ||
          item.stateMutability === "payable"

        if (isRead || isWrite) {
          functions.push({
            name: item.name,
            type: isRead ? "read" : "write",
            inputs: item.inputs,
            outputs: item.outputs,
            stateMutability: item.stateMutability,
            abiFunction: item,
          })
        }
      }
    }

    return functions
  } catch {
    return null
  }
}

export function getReadFunctions(abi: Abi): ParsedFunction[] {
  const parsed = parseABI(abi)
  if (!parsed) return []
  return parsed.filter((f) => f.type === "read")
}

export function getWriteFunctions(abi: Abi): ParsedFunction[] {
  const parsed = parseABI(abi)
  if (!parsed) return []
  return parsed.filter((f) => f.type === "write")
}

