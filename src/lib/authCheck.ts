import { CONTEX_CONFIG_VERSION } from "./config"
import { useABIStore } from "@/stores/abiStore"
import { useContractStore } from "@/stores/contractStore"

const CONFIG_VERSION_KEY = "contexConfigVersion"

export interface AuthCheckResult {
  requiresUserAction: boolean
  message?: string
}

/**
 * Checks if the user's stored configuration version matches the current app version.
 * Returns information about whether user action is required.
 */
export function checkAuth(): AuthCheckResult {
  const storedVersion = localStorage.getItem(CONFIG_VERSION_KEY)
  const currentVersion = CONTEX_CONFIG_VERSION

  // First time user or no version stored
  if (!storedVersion) {
    localStorage.setItem(CONFIG_VERSION_KEY, currentVersion)
    return { requiresUserAction: false }
  }

  // Version matches - user is authorized
  if (storedVersion === currentVersion) {
    return { requiresUserAction: false }
  }

  // Version mismatch - check if user has ABIs stored
  // Check localStorage directly since store might not be hydrated yet
  const abiStorage = localStorage.getItem("abi-storage")
  let hasABIs = false
  if (abiStorage) {
    try {
      const parsed = JSON.parse(abiStorage)
      hasABIs = parsed.state?.abis && Object.keys(parsed.state.abis).length > 0
    } catch {
      // Invalid storage, treat as no ABIs
      hasABIs = false
    }
  }

  if (!hasABIs) {
    // No ABIs stored, just update version and continue
    localStorage.setItem(CONFIG_VERSION_KEY, currentVersion)
    return { requiresUserAction: false }
  }

  // Version mismatch and user has ABIs - requires user action
  return {
    requiresUserAction: true,
    message: "Contex version has been upgraded. You must re-import and re-configure your contracts.",
  }
}

/**
 * Purges all user storage and stamps the current version.
 * This should be called after the user acknowledges the version upgrade alert.
 */
export function purgeStorageAndStampVersion(): void {
  // Clear ABI store
  localStorage.removeItem("abi-storage")
  
  // Clear contract store
  localStorage.removeItem("contract-explorer-storage")
  
  // Clear form state from sessionStorage
  sessionStorage.removeItem("contract-explorer-form-state")
  
  // Reset stores to initial state
  const abiStore = useABIStore.getState()
  abiStore.setABIs({})
  abiStore.setABILabels({})
  
  const contractStore = useContractStore.getState()
  contractStore.setContracts({})
  contractStore.setSelectedContract(null)
  
  // Stamp current version
  localStorage.setItem(CONFIG_VERSION_KEY, CONTEX_CONFIG_VERSION)
}

