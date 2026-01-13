import { useEffect, useState, useMemo } from "react"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { ContractView } from "./ContractView"
import { AddContractModal } from "./AddContractModal"
import { ABIManagerModal } from "./ABIManagerModal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function ContractExplorer() {
  const { contracts, selectedAbiKey, setSelectedAbiKey } = useContractStore()
  const { abis } = useABIStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)

  useEffect(() => {
    // Initialize formState from sessionStorage
    const { initializeFormState } = useContractStore.getState()
    initializeFormState()
  }, [])

  useEffect(() => {
    // Debug helper: dump all relevant storage and in-memory mappings when they change
    try {
      // In-memory store state
      const abiKeys = Object.keys(abis)
      const contractKeys = Object.keys(contracts)
      const contractEntries = contractKeys.map(
        (abiKey) => ({ abiKey, addressCount: contracts[abiKey]?.length || 0 })
      )

      console.log("[ContractExplorer] Debug - ABI/Contract snapshot", {
        abiKeys,
        contractKeys,
        contracts: contractEntries,
        abis: Object.entries(abis).map(([key, entry]) => ({ abiKey: key, label: entry.label })),
      })

      // Raw storage contents
      const rawAbiStorage = localStorage.getItem("abi-storage")
      const rawContractStorage = localStorage.getItem("contract-explorer-storage")
      const rawFormState = sessionStorage.getItem("contract-explorer-form-state")
      const configVersion = localStorage.getItem("contexConfigVersion")

      let parsedAbiStorage: unknown = null
      let parsedContractStorage: unknown = null
      let parsedFormState: unknown = null

      try {
        parsedAbiStorage = rawAbiStorage ? JSON.parse(rawAbiStorage) : null
      } catch (e) {
        parsedAbiStorage = { parseError: String(e) }
      }

      try {
        parsedContractStorage = rawContractStorage
          ? JSON.parse(rawContractStorage)
          : null
      } catch (e) {
        parsedContractStorage = { parseError: String(e) }
      }

      try {
        parsedFormState = rawFormState ? JSON.parse(rawFormState) : null
      } catch (e) {
        parsedFormState = { parseError: String(e) }
      }

      console.log("[ContractExplorer] Debug - Raw storage snapshot", {
        rawAbiStorage,
        rawContractStorage,
        rawFormState,
        configVersion,
      })

      console.log("[ContractExplorer] Debug - Parsed storage snapshot", {
        abiStorage: parsedAbiStorage,
        contractStorage: parsedContractStorage,
        formState: parsedFormState,
      })
    } catch (e) {
      console.warn("[ContractExplorer] Failed to log ABI/Contract snapshot", e)
    }
  }, [abis, contracts])

  const abiKeys = Object.keys(contracts).filter((key) => contracts[key].length > 0)

  const activeAbiKey = useMemo(() => {
    if (abiKeys.length === 0) return null
    return (selectedAbiKey && abiKeys.includes(selectedAbiKey))
      ? selectedAbiKey
      : abiKeys[0]
  }, [abiKeys, selectedAbiKey])

  useEffect(() => {
    if (activeAbiKey && activeAbiKey !== selectedAbiKey) {
      setSelectedAbiKey(activeAbiKey)
    }
  }, [activeAbiKey, selectedAbiKey, setSelectedAbiKey])

  if (abiKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">
          No contracts registered yet. Add your first contract to get started.
        </p>
        <Button onClick={() => setIsAddContractOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contract
        </Button>
        <AddContractModal
          open={isAddContractOpen}
          onOpenChange={setIsAddContractOpen}
        />
      </div>
    )
  }

  if (!activeAbiKey) {
    return null
  }

  return (
    <div className="space-y-4 h-full flex flex-col min-h-0 overflow-hidden">
      <ContractView abiKey={activeAbiKey} />
      <AddContractModal
        open={isAddContractOpen}
        onOpenChange={setIsAddContractOpen}
      />
      <ABIManagerModal
        open={isABIManagerOpen}
        onOpenChange={setIsABIManagerOpen}
      />
    </div>
  )
}

