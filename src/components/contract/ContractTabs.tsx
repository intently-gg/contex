import { useEffect } from "react"
import { useContractStore } from "@/stores/contractStore"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ContractView } from "./ContractView"

interface ContractTabsProps {
  onAddContract?: () => void
}

export function ContractTabs({ onAddContract: _onAddContract }: ContractTabsProps) {
  const { contracts, selectedContract, setSelectedContract } = useContractStore()
  const contractLabels = Object.keys(contracts)

  if (contractLabels.length === 0) {
    return null
  }

  // Validate that selectedContract still exists, fallback to first if not
  const activeContract = (selectedContract && contractLabels.includes(selectedContract))
    ? selectedContract
    : contractLabels[0]

  // Update store if selectedContract was invalid
  useEffect(() => {
    if (activeContract !== selectedContract) {
      setSelectedContract(activeContract)
    }
  }, [activeContract, selectedContract, setSelectedContract])

  return (
    <Tabs
      value={activeContract}
      onValueChange={setSelectedContract}
      className="w-full h-full flex flex-col min-h-0"
    >
      {contractLabels.map((label) => (
        <TabsContent key={label} value={label} className="h-full flex flex-col min-h-0">
          <ContractView contractLabel={label} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

