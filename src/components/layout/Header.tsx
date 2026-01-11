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
import { FileJson, Plus, Calculator } from "lucide-react"
import { useState } from "react"
import { AddContractModal } from "@/components/contract/AddContractModal"
import { ABIManagerModal } from "@/components/contract/ABIManagerModal"
import { ValueParserModal } from "@/components/contract/ValueParserModal"

export function Header() {
  const { theme, toggleTheme } = useThemeStore()
  const [isAddContractOpen, setIsAddContractOpen] = useState(false)
  const [isABIManagerOpen, setIsABIManagerOpen] = useState(false)
  const [isValueHelperOpen, setIsValueHelperOpen] = useState(false)

  return (
    <header className="bg-background">
      <div className="w-full flex h-12 border-b border-border items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 25 25"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
          >
            <path
              d="M1 5V20M24 5V20M1 5C1 3.34315 2.34315 2 4 2H21C22.6569 2 24 3.34315 24 5M1 5C1 6.65685 2.34315 8 4 8H21C22.6569 8 24 6.65685 24 5M1 20C1 18.3431 2.34315 17 4 17H21C22.6569 17 24 18.3431 24 20M1 20C1 21.6569 2.34315 23 4 23H21C22.6569 23 24 21.6569 24 20"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M5 12.5C5 12.5 8 8.5 12.5 8.5C17 8.5 20 12.5 20 12.5C20 12.5 17 16.5 12.5 16.5C8 16.5 5 12.5 5 12.5Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="12.5" cy="12.5" r="1.5" fill="currentColor" />
          </svg>
          <h1 className="text-xl font-bold">Contex</h1>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu"
                className="hover:bg-accent hover:text-accent-foreground transition-colors"
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
              <DropdownMenuItem onClick={() => setIsValueHelperOpen(true)}>
                <Calculator className="mr-2 h-4 w-4" />
                Value Helper
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <div style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
            <ConnectButton showBalance={false} chainStatus="icon" />
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
      <ValueParserModal
        open={isValueHelperOpen}
        onOpenChange={setIsValueHelperOpen}
        fieldName="value"
        fieldType="uint256"
        disconnected={true}
      />
    </header>
  )
}

