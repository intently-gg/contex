import type { AbiParameter } from "viem"
import { parseInputValue } from "./formGenerator"
import { safeStringify } from "./utils"

/**
 * Parse a tuple value from a string (JSON) into an object
 */
export function parseTupleValue(value: string, _components: readonly AbiParameter[]): Record<string, unknown> | null {
  if (!value || value.trim() === "") {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Serialize a tuple value to JSON string
 */
export function serializeTupleValue(value: Record<string, unknown>): string {
  return JSON.stringify(value)
}

/**
 * Parse a list/array value from a string (JSON) into an array
 */
export function parseListValue(value: string): unknown[] | null {
  if (!value || value.trim() === "") {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Serialize a list/array value to JSON string
 */
export function serializeListValue(value: unknown[]): string {
  return JSON.stringify(value)
}

/**
 * Convert tuple values to the format expected by viem (array of values in component order)
 */
export function tupleToArray(tuple: Record<string, unknown>, components: readonly AbiParameter[]): unknown[] {
  return components.map((comp) => {
    const name = comp.name || ""
    const value = tuple[name] ?? tuple[comp.name || ""] ?? ""
    return parseInputValue(String(value), comp.type)
  })
}

/**
 * Serialize tuple as array of stringified values
 */
export function serializeTupleAsArray(tuple: Record<string, unknown>, components: readonly AbiParameter[]): string {
  const arrayValue = tupleToArray(tuple, components)
  return safeStringify(arrayValue)
}

/**
 * Convert array of values to tuple object (by component name)
 */
export function arrayToTuple(values: unknown[], components: readonly AbiParameter[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  components.forEach((comp, index) => {
    const name = comp.name || `param_${index}`
    result[name] = values[index] ?? ""
  })
  return result
}

