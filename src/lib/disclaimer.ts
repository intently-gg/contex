export const DISCLAIMER_VERSION = "1.0"

export interface DisclaimerSignature {
  walletAddress: string
  timestamp: string
  versionId: string
  ipAddress: string
  userAgent: string
  termsHash: string
}

export interface DisclaimerCheckResponse {
  signed: boolean
  signature?: DisclaimerSignature
}

export async function checkDisclaimerSignature(
  walletAddress: string
): Promise<DisclaimerCheckResponse> {
  try {
    const response = await fetch(`/api/disclaimer/check?walletAddress=${encodeURIComponent(walletAddress)}`)
    
    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text()
      throw new Error(`Invalid response from server: ${text.substring(0, 100)}`)
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to check signature")
    }
    
    return await response.json()
  } catch (error) {
    throw error
  }
}

export async function signDisclaimer(
  walletAddress: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/disclaimer/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        versionId: DISCLAIMER_VERSION,
      }),
    })
    
    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text()
      throw new Error(`Invalid response from server: ${text.substring(0, 100)}`)
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to sign disclaimer")
    }
    
    return true
  } catch (error) {
    throw error
  }
}

