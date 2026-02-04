import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { keccak256, stringToHex } from "viem"
import {
  ASSETS_VERIFIED_HASH,
  ASSETS_VERIFICATION_SALT,
  DEFAULT_REGISTERED_ADDRESSES,
  getAssetsVerificationPayload,
} from "@/lib/config"
import "./index.css"
import App from "./App.tsx"

const assets = DEFAULT_REGISTERED_ADDRESSES.filter((a) => a.type === "Asset")
const payload = getAssetsVerificationPayload(assets)
const computedHash = keccak256(stringToHex(ASSETS_VERIFICATION_SALT + payload))
const assetsVerified =
  ASSETS_VERIFIED_HASH.length > 0 && computedHash === ASSETS_VERIFIED_HASH

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
    originalUnhandledRejection.call(window, event)
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

function Root() {
  if (!assetsVerified) {
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "32rem",
          margin: "2rem auto",
          fontFamily: "system-ui, sans-serif",
          color: "hsl(var(--foreground))",
        }}
      >
        {/* this error should only happen if a deployment is screwed up somehow.
        IE: we did not recalculate/update our ASSETS_VERIFIED_HASH on config.ts
        check config.ts for more details on how to resolve. */}
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          Sorry, contex is currently unavailable
        </h1>
        <p style={{ marginBottom: "1rem" }}>
          Error Code: 5505
        </p>
        <p style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))" }}>
          Hash: <code style={{ wordBreak: "break-all" }}>{computedHash || "(none)"}</code>
        </p>
      </div>
    )
  }
  return (
    <StrictMode>
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById("root")!).render(<Root />)
