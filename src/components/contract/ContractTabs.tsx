import { useEffect } from "react"
import { useContractStore } from "@/stores/contractStore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContractView } from "./ContractView"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ContractTabsProps {
  onAddContract?: () => void
}

export function ContractTabs({ onAddContract }: ContractTabsProps) {
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
      className="w-full"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-muted-foreground" style={{ paddingLeft: '10px' }}>ABI List</span>
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground overflow-x-auto overflow-y-hidden border flex-1" style={{ border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--muted))' }}>
          {contractLabels.map((label) => (
            <TabsTrigger 
              key={label} 
              value={label}
              style={{
                transition: 'all 150ms',
                backgroundColor: activeContract === label ? 'hsl(var(--background))' : 'hsl(var(--muted) / 0.4)',
                color: activeContract === label ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                boxShadow: activeContract === label ? '0 2px 4px 0 rgb(0 0 0 / 0.1)' : 'none',
                fontWeight: activeContract === label ? '600' : '400',
                border: '1px solid',
                borderColor: activeContract === label ? 'hsl(var(--border))' : 'hsl(var(--border) / 0.5)',
              }}
              className="!inline-flex !items-center !justify-center !whitespace-nowrap !rounded-md !px-4 !py-1.5 !text-sm !font-medium !ring-offset-background !transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 hover:!bg-background/70 hover:!shadow-sm"
              onMouseEnter={(e) => {
                if (activeContract !== label) {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--background) / 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (activeContract !== label) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              {label}
            </TabsTrigger>
          ))}
          {onAddContract && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddContract}
              style={{
                height: '32px',
                width: '32px',
                minWidth: '32px',
                padding: '0',
                marginLeft: '4px',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
              }}
              className="!inline-flex !items-center !justify-center !rounded-md hover:!bg-background/70 hover:!shadow-sm !transition-all"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'hsl(var(--background) / 0.5)'
                e.currentTarget.style.borderColor = 'hsl(var(--border))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </TabsList>
      </div>
      {contractLabels.map((label) => (
        <TabsContent key={label} value={label} className="mt-4">
          <ContractView contractLabel={label} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

