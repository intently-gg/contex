import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
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
