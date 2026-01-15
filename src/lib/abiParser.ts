import type { Abi, AbiFunction } from "viem"
import { getFunctionSelector } from "viem"

export interface ParsedFunction {
  name: string
  functionId: string
  displayName: string
  type: "read" | "write"
  inputs: AbiFunction["inputs"]
  outputs: AbiFunction["outputs"]
  stateMutability: AbiFunction["stateMutability"]
  abiFunction: AbiFunction
}

function getFunctionId(abiFunction: AbiFunction): string {
  try {
    const inputTypes = abiFunction.inputs.map((input) => input.type).join(",")
    const signature = `${abiFunction.name}(${inputTypes})`
    return getFunctionSelector(signature)
  } catch {
    const inputTypes = abiFunction.inputs.map((input) => input.type).join(",")
    return `${abiFunction.name}(${inputTypes})`
  }
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
          const functionId = getFunctionId(item)
          
          functions.push({
            name: item.name,
            functionId,
            displayName: item.name,
            type: isRead ? "read" : "write",
            inputs: item.inputs,
            outputs: item.outputs,
            stateMutability: item.stateMutability,
            abiFunction: item,
          })
        }
      }
    }

    const nameToOverloads: Record<string, ParsedFunction[]> = {}
    for (const func of functions) {
      if (!nameToOverloads[func.name]) {
        nameToOverloads[func.name] = []
      }
      nameToOverloads[func.name].push(func)
    }

    for (const [name, overloads] of Object.entries(nameToOverloads)) {
      if (overloads.length > 1) {
        overloads.forEach((func, index) => {
          func.displayName = `${name} (${index + 1})`
        })
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

