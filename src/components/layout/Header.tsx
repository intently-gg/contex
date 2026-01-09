import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Moon, Sun, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/stores/themeStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileJson, Plus } from "lucide-react"
import { useState } from "react"
import { AddContractModal } from "@/components/contract/AddContractModal"
import { ABIManagerModal } from "@/components/contract/ABIManagerModal"

export function Header() {
  const { theme, toggleTheme } = useThemeStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)

  return (
    <header className="bg-background">
      <div className="w-full flex h-16 items-center justify-between px-4">
        <h1 className="text-xl font-bold">Contex</h1>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsABIManagerOpen(true)}>
                <FileJson className="mr-2 h-4 w-4" />
                Manage ABIs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAddContractOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Contract
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <div style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
            <ConnectButton accountStatus="avatar" chainStatus="icon" />
          </div>
        </div>
      </div>
      <AddContractModal
        open={isAddContractOpen}
        onOpenChange={setIsAddContractOpen}
      />
      <ABIManagerModal
        open={isABIManagerOpen}
        onOpenChange={setIsABIManagerOpen}
      />
    </header>
  )
}

