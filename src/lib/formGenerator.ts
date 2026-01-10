import type { AbiParameter } from "viem"

export interface FormField {
  name: string
  type: string
  component: "input" | "textarea" | "checkbox" | "array"
  placeholder?: string
  required: boolean
  abiParam: AbiParameter
}

export function generateFormFields(inputs: AbiParameter[]): FormField[] {
  return inputs.map((input) => {
    const baseField: FormField = {
      name: input.name || `param_${inputs.indexOf(input)}`,
      type: input.type,
      component: "input",
      required: true,
      abiParam: input,
    }

    if (input.type.includes("[]")) {
      baseField.component = "array"
      baseField.placeholder = `Array of ${input.type.replace("[]", "")}`
    } else if (input.type === "bool") {
      baseField.component = "checkbox"
    } else if (input.type.includes("bytes") && input.type !== "bytes") {
      baseField.component = "textarea"
      baseField.placeholder = `0x...`
    } else if (input.type === "string" || input.type === "bytes") {
      baseField.component = "textarea"
    } else {
      baseField.component = "input"
      if (input.type.startsWith("uint") || input.type.startsWith("int")) {
        baseField.placeholder = `Number (${input.type})`
      } else if (input.type === "address") {
        baseField.placeholder = "0x..."
      }
    }

    return baseField
  })
}

export function needsValueParser(fieldName: string, fieldType: string): boolean {
  const lowerName = fieldName.toLowerCase()
  const lowerType = fieldType.toLowerCase()
  
  // Check if it's any uint or int type (not just 256)
  const isUintOrInt = fieldType.startsWith("uint") || fieldType.startsWith("int")
  
  return (
    isUintOrInt ||
    lowerName.includes("wei") ||
    lowerName.includes("amount") ||
    lowerName.includes("units") ||
    lowerType.includes("wei") ||
    lowerType.includes("amount") ||
    lowerType.includes("units")
  )
}

export function isTupleType(fieldType: string): boolean {
  return fieldType.startsWith("tuple")
}

export function isListType(fieldType: string): boolean {
  return fieldType.includes("[]")
}

export function getBaseType(fieldType: string): string {
  if (isListType(fieldType)) {
    return fieldType.replace("[]", "")
  }
  return fieldType
}

export function parseInputValue(
  value: string,
  type: string
): string | number | bigint | boolean | string[] | unknown[] {
  if (type === "bool") {
    return value === "true" || value === "1"
  }

  // Handle tuples - viem expects them as arrays
  if (type.startsWith("tuple") && !type.includes("[]")) {
    try {
      const parsed = JSON.parse(value)
      // If it's already an array, return it directly (viem expects tuples as arrays)
      if (Array.isArray(parsed)) {
        return parsed
      }
      // If it's an object, we'd need components to convert it, but for now return as-is
      // The WriteFunction should handle this case
      return parsed
    } catch {
      // If parsing fails, return as string and let viem handle it
      return value
    }
  }

  if (type.includes("[]")) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      return value.split(",").map((v) => v.trim())
    }
  }

  if (type.startsWith("uint") || type.startsWith("int")) {
    try {
      if (type.includes("256") || type.includes("128")) {
        return BigInt(value)
      }
      return Number(value)
    } catch {
      return value
    }
  }

  if (type === "address") {
    return value.trim()
  }

  if (type.includes("bytes")) {
    return value.startsWith("0x") ? value : `0x${value}`
  }

  return value
}

