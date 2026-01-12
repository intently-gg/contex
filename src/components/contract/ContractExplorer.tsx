import { useEffect, useState } from "react"
import { useContractStore } from "@/stores/contractStore"
import { ContractTabs } from "./ContractTabs"
import { AddContractModal } from "./AddContractModal"
import { ABIManagerModal } from "./ABIManagerModal"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function ContractExplorer() {
  const { contracts } = useContractStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)

  useEffect(() => {
    // Initialize formState from sessionStorage
    const { initializeFormState } = useContractStore.getState()
    initializeFormState()
  }, [])

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
    <div className="space-y-4 h-full flex flex-col min-h-0 overflow-hidden">
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

