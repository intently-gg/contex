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
        <div className="h-screen bg-background flex flex-col overflow-hidden">
          <Header />
          <main className="w-full flex-1 flex flex-col overflow-hidden min-h-0" >
            <ContractExplorer />
          </main>
          <footer className="w-full flex items-center justify-between px-4 py-1 text-[11px] text-muted-foreground border-t border-border flex-none">
            <span>Contex © {new Date().getFullYear()}</span>
            <a
              href="https://intently.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Built by Intently
            </a>
          </footer>
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
