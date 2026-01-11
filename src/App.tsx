import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit"
import { Toaster } from "sonner"
import "@rainbow-me/rainbowkit/styles.css"
import { config } from "@/lib/wagmi"
import { Header } from "@/components/layout/Header"
import { ContractExplorer } from "@/components/contract/ContractExplorer"
import { useThemeStore } from "@/stores/themeStore"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthCheck } from "@/components/auth/AuthCheck"

const queryClient = new QueryClient()

function AppContent() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <AuthCheck>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="w-full">
            <ContractExplorer />
          </main>
          <Toaster />
        </div>
      </TooltipProvider>
    </AuthCheck>
  )
}

function ThemedRainbowKitProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore()
  const rainbowKitTheme = theme === "dark" ? darkTheme() : lightTheme()

  return <RainbowKitProvider theme={rainbowKitTheme}>{children}</RainbowKitProvider>
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemedRainbowKitProvider>
          <AppContent />
        </ThemedRainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
