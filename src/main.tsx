import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"

// Suppress console errors for 403 responses from chain icon sources
const originalError = console.error
console.error = (...args: any[]) => {
  const message = args.join(" ").toLowerCase()
  if (
    ((message.includes("cdn.jsdelivr.net") && message.includes("chain-icons")) ||
     (message.includes("chainlistapi.com") && message.includes("icons"))) &&
    (message.includes("403") || message.includes("failed to load") || message.includes("network error"))
  ) {
    return
  }
  originalError.apply(console, args)
}

// Suppress unhandled promise rejections for chain icon fetches
const originalUnhandledRejection = window.onunhandledrejection
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.toString()?.toLowerCase() || ""
  if (
    ((message.includes("cdn.jsdelivr.net") && message.includes("chain-icons")) ||
     (message.includes("chainlistapi.com") && message.includes("icons"))) &&
    (message.includes("403") || message.includes("failed"))
  ) {
    event.preventDefault()
    return
  }
  if (originalUnhandledRejection) {
    originalUnhandledRejection(event)
  }
})

// Suppress error events for chain icon loads
window.addEventListener("error", (event) => {
  const message = event.message?.toLowerCase() || event.filename?.toLowerCase() || ""
  if (
    ((message.includes("cdn.jsdelivr.net") && message.includes("chain-icons")) ||
     (message.includes("chainlistapi.com") && message.includes("icons"))) &&
    (message.includes("403") || message.includes("failed"))
  ) {
    event.preventDefault()
    return false
  }
}, true)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
