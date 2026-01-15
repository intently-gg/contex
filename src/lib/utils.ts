import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getFunctionSelector, type AbiFunction, type Abi, type AbiParameter } from "viem"
import { parseABI, type ParsedFunction } from "./abiParser"
import type { ABIEntry } from "@/stores/abiStore"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
  }
  return value
}

/**
 * Recursively convert BigInt values to strings in objects/arrays
 * This makes values serializable for React DevTools
 */
export function sanitizeForSerialization(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }
  
  if (typeof value === "bigint") {
    return value.toString()
  }
  
  if (Array.isArray(value)) {
    return value.map(sanitizeForSerialization)
  }
  
  if (typeof value === "object") {
    // Handle Error objects specially - preserve message and name but sanitize other properties
    if (value instanceof Error) {
      const sanitized: Record<string, unknown> = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
      // Sanitize any additional properties that might contain BigInt
      for (const [key, val] of Object.entries(value)) {
        if (!["name", "message", "stack"].includes(key)) {
          sanitized[key] = sanitizeForSerialization(val)
        }
      }
      return sanitized
    }
    
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeForSerialization(val)
    }
    return sanitized
  }
  
  return value
}

// Safe JSON.stringify that handles BigInt
export function safeStringify(value: unknown, space?: string | number): string {
  return JSON.stringify(value, bigintReplacer, space)
}

export function formatBigInt(value: bigint | string | number): string {
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (typeof value === "string") {
    try {
      const num = BigInt(value)
      return num.toString()
    } catch {
      return value
    }
  }
  return String(value)
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Check if a value is "empty" (only empty arrays, nested or not)
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return true
    // Check if all elements are empty
    return value.every((item) => isEmptyValue(item))
  }
  
  return false
}

/**
 * Format value for display (remove quotes for simple values)
 */
export function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return "null"
  }
  
  if (typeof value === "string") {
    return value
  }
  
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  
  if (typeof value === "bigint") {
    return value.toString()
  }
  
  // For objects/arrays, stringify
  return safeStringify(value)
}

/**
 * Safely copy text to clipboard with fallback for environments where navigator.clipboard is not available
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (error) {
    // Fall through to fallback
  }
  
  // Fallback to execCommand method
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.left = "-999999px"
  textarea.style.top = "-999999px"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  
  try {
    const successful = document.execCommand("copy")
    document.body.removeChild(textarea)
    return successful
  } catch (error) {
    document.body.removeChild(textarea)
    return false
  }
}

/**
 * Truncate label to 75 characters, returning both truncated and original
 */
export function truncateLabel(label: string, maxLength: number = 75): { display: string; full: string } {
  const full = label || ""
  if (full.length <= maxLength) {
    return { display: full, full: full }
  }
  return { display: full.slice(0, maxLength) + "...", full }
}

/**
 * Expand a type string, replacing tuple types with their component types
 * This is needed for proper function signature calculation
 */
export function expandTypeForSignature(param: AbiParameter): string {
  const type = param.type
  
  // Handle array types - extract base type and array suffix
  const arrayMatch = type.match(/^(.*)(\[\d*\])$/)
  const baseType = arrayMatch ? arrayMatch[1] : type
  const arraySuffix = arrayMatch ? arrayMatch[2] : ""
  
  // If it's a tuple, expand it
  if (baseType === "tuple" || baseType.startsWith("tuple")) {
    const components = (param as any).components as readonly AbiParameter[] | undefined
    if (components && components.length > 0) {
      // Recursively expand each component
      const expandedComponents = components.map(comp => expandTypeForSignature(comp)).join(",")
      return `(${expandedComponents})${arraySuffix}`
    }
    // Fallback if no components (shouldn't happen, but be safe)
    return `tuple${arraySuffix}`
  }
  
  // Not a tuple, return as-is with array suffix
  return type
}

/**
 * Get function signature (4-byte selector) from a function ABI
 * Properly handles tuple types by expanding them into their component types
 */
export function getFunctionSignature(abiFunction: AbiFunction): string {
  try {
    const inputTypes = abiFunction.inputs.map((input) => expandTypeForSignature(input)).join(",")
    const signature = `${abiFunction.name}(${inputTypes})`
    return getFunctionSelector(signature)
  } catch {
    return ""
  }
}

/**
 * Extract function selector (first 4 bytes / 8 hex chars) from bytes value
 */
export function extractFunctionSelector(bytesValue: string | unknown): string | null {
  if (typeof bytesValue !== "string") return null
  const cleaned = bytesValue.trim()
  if (!cleaned.startsWith("0x")) return null
  if (cleaned.length < 10) return null // Need at least 0x + 8 hex chars
  return cleaned.slice(0, 10).toLowerCase() // 0x + 8 hex chars
}

/**
 * Find matching function by signature across all registered ABIs
 * Returns first match found with abiKey, abiLabel, and function info
 */
export function findFunctionBySignature(
  selector: string,
  abis: Record<string, ABIEntry>
): { abiKey: string; abiLabel: string; func: ParsedFunction; abi: Abi } | null {
  if (!selector || selector.length !== 10 || !selector.startsWith("0x")) return null

  for (const [abiKey, entry] of Object.entries(abis)) {
    const abi = entry.abi as Abi | undefined
    if (!abi) continue

    const parsed = parseABI(abi)
    if (!parsed) continue

    for (const func of parsed) {
      const funcSignature = getFunctionSignature(func.abiFunction)
      if (funcSignature.toLowerCase() === selector.toLowerCase()) {
        return {
          abiKey,
          abiLabel: entry.label,
          func,
          abi,
        }
      }
    }
  }

  return null
}
