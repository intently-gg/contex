import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { Toaster } from "sonner"
import "@rainbow-me/rainbowkit/styles.css"
import { config } from "@/lib/wagmi"
import { Header } from "@/components/layout/Header"
import { ContractExplorer } from "@/components/contract/ContractExplorer"
import { useThemeStore } from "@/stores/themeStore"
import { TooltipProvider } from "@/components/ui/tooltip"

const queryClient = new QueryClient()

function AppContent() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="w-full">
          <ContractExplorer />
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  )
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
