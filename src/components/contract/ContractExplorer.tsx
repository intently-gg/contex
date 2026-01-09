import { useEffect, useState } from "react"
import { useContractStore } from "@/stores/contractStore"
import { loadContracts } from "@/lib/contractRegistry"
import { ContractTabs } from "./ContractTabs"
import { AddContractModal } from "./AddContractModal"
import { ABIManagerModal } from "./ABIManagerModal"
import { Button } from "@/components/ui/button"
import { Plus, FileJson } from "lucide-react"

export function ContractExplorer() {
  const { contracts, setContracts } = useContractStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    // Only load from file if store is empty (first load)
    if (!hasLoaded && Object.keys(contracts).length === 0) {
      loadContracts().then((fileContracts) => {
        if (Object.keys(fileContracts).length > 0) {
          setContracts(fileContracts)
        }
        setHasLoaded(true)
      })
    } else {
      setHasLoaded(true)
    }
    // Initialize formState from sessionStorage
    const { initializeFormState } = useContractStore.getState()
    initializeFormState()
  }, [contracts, setContracts, hasLoaded])

  const contractLabels = Object.keys(contracts)

  if (contractLabels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">
          No contracts registered. Add your first contract to get started.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setIsABIManagerOpen(true)}>
            <FileJson className="mr-2 h-4 w-4" />
            Manage ABIs
          </Button>
          <Button onClick={() => setIsAddContractOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contract
          </Button>
        </div>
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

