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
import { DisclaimerGuard } from "@/components/auth/DisclaimerGuard"
import { DatabaseHealthCheck } from "@/components/auth/DatabaseHealthCheck"

const queryClient = new QueryClient()

function AppContent() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  return (
    <AuthCheck>
      <DisclaimerGuard>
        <TooltipProvider>
          <div className="h-screen bg-background flex flex-col overflow-hidden">
            <Header />
            <main className="w-full flex-1 flex flex-col overflow-hidden min-h-0" >
              <ContractExplorer />
            </main>
            <footer className="bg-background w-full flex items-center justify-between px-4 py-1 text-[10px] text-muted-foreground border-t border-border flex-none">
            <a
                href="https://intently.gg"
                target="_blank"
                rel="noopener noreferrer"
                className="underline flex items-center gap-1"
              >
                Built by  
                <img src="/intently.png" alt="intently" style={{ height: "16px" }} className={`h-3 w-auto ${theme === "dark" ? "invert" : ""}`} />
              </a>
              <span>contex © {new Date().getFullYear()}</span>
            </footer>
            <Toaster />
          </div>
        </TooltipProvider>
      </DisclaimerGuard>
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
    <DatabaseHealthCheck>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ThemedRainbowKitProvider>
            <AppContent />
          </ThemedRainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </DatabaseHealthCheck>
  )
}

export default App
