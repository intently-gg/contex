import { safeStringify } from "@/lib/utils"

export interface ABILabel {
  filename: string
  label: string
}

const ABI_LABELS_FILE = "/abi-labels.json"

export async function loadABILabels(): Promise<Record<string, string>> {
  try {
    const response = await fetch(ABI_LABELS_FILE)
    if (!response.ok) {
      return {}
    }
    return await response.json()
  } catch {
    return {}
  }
}

export async function saveABILabels(
  labels: Record<string, string>
): Promise<void> {
  try {
      await fetch("/api/abi-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify(labels, 2),
      })
  } catch (error) {
    console.error("Failed to save ABI labels:", error)
    throw error
  }
}

export function getABILabel(
  labels: Record<string, string>,
  filename: string
): string {
  return labels[filename] || filename.replace(/\.json$/, "")
}

