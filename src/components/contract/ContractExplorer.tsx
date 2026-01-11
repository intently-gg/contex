import { useEffect, useState } from "react"
import { useContractStore } from "@/stores/contractStore"
import { loadContracts } from "@/lib/contractRegistry"
import { ContractTabs } from "./ContractTabs"
import { AddContractModal } from "./AddContractModal"
import { ABIManagerModal } from "./ABIManagerModal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function ContractExplorer() {
  const { contracts, setContracts } = useContractStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)
  const [hasMigrated, setHasMigrated] = useState(false)

  useEffect(() => {
    // One-time migration from file to localStorage (if file exists and store is empty)
    // After migration, contracts are stored in localStorage via the contractStore's persist middleware
    if (!hasMigrated && Object.keys(contracts).length === 0) {
      loadContracts().then((fileContracts) => {
        if (Object.keys(fileContracts).length > 0) {
          setContracts(fileContracts)
        }
        setHasMigrated(true)
      })
    } else {
      setHasMigrated(true)
    }
    // Initialize formState from sessionStorage
    const { initializeFormState } = useContractStore.getState()
    initializeFormState()
  }, [contracts, setContracts, hasMigrated])

  const contractLabels = Object.keys(contracts)

  if (contractLabels.length === 0) {
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

  return (
    <div className="space-y-4">
      <ContractTabs 
        onAddContract={() => setIsAddContractOpen(true)}
      />
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

