import { useState, useEffect, useRef } from "react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { DisclaimerModal } from "./DisclaimerModal"
import { SigningError } from "./SigningError"
import { checkDisclaimerSignature, signDisclaimer } from "@/lib/disclaimer"

const DISCLAIMER_AGREED_KEY = "disclaimer-agreed-pending"

export function DisclaimerConnectButton() {
  const { address, isConnected } = useAccount()
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [pendingConnect, setPendingConnect] = useState(false)
  const [allowConnect, setAllowConnect] = useState(false)
  const [signingError, setSigningError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isConnected && address) {
      checkDisclaimerSignature(address)
        .then((result) => {
          if (!result.signed) {
            const hasPendingAgreement = localStorage.getItem(DISCLAIMER_AGREED_KEY) === "true"
            if (hasPendingAgreement) {
              signDisclaimer(address)
                .then((success) => {
                  if (success) {
                    localStorage.removeItem(DISCLAIMER_AGREED_KEY)
                  } else {
                    throw new Error("Failed to sign disclaimer")
                  }
                })
                .catch((error) => {
                  const errorMessage = error instanceof Error ? error.message : "Failed to sign disclaimer"
                  setSigningError(errorMessage)
                })
            } else {
              setShowDisclaimer(true)
            }
          }
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : "Failed to check"
          setSigningError(errorMessage)
        })
    }
  }, [isConnected, address])

  useEffect(() => {
    if (!buttonRef.current || allowConnect || isConnected) return

    const handleClick = async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPendingConnect(true)
      setShowDisclaimer(true)
    }

    const button = buttonRef.current.querySelector("button")
    if (button) {
      button.addEventListener("click", handleClick, true)
      return () => {
        button.removeEventListener("click", handleClick, true)
      }
    }
  }, [isConnected, address, allowConnect])

  const handleAgree = async () => {
    if (pendingConnect) {
      try {
        localStorage.setItem(DISCLAIMER_AGREED_KEY, "true")
        setPendingConnect(false)
        setShowDisclaimer(false)
        setAllowConnect(true)
        setTimeout(() => {
          const button = buttonRef.current?.querySelector("button")
          if (button) {
            button.click()
          }
          setAllowConnect(false)
        }, 100)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to prepare connection"
        setSigningError(errorMessage)
        setShowDisclaimer(false)
      }
      return
    }

    if (!address) return

    try {
      const success = await signDisclaimer(address)
      if (success) {
        setShowDisclaimer(false)
        setSigningError(null)
      } else {
        throw new Error("Failed to sign disclaimer")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sign disclaimer"
      setSigningError(errorMessage)
      setShowDisclaimer(false)
    }
  }

  const handleDecline = () => {
    setShowDisclaimer(false)
    setPendingConnect(false)
  }

  const handleRetry = () => {
    setSigningError(null)
    if (isConnected && address) {
      setShowDisclaimer(true)
    } else {
      setPendingConnect(true)
      setShowDisclaimer(true)
    }
  }

  if (signingError) {
    return <SigningError onRetry={handleRetry} error={signingError} />
  }

  return (
    <>
      <div ref={buttonRef} style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
      <DisclaimerModal
        open={showDisclaimer}
        onAgree={handleAgree}
        onDecline={handleDecline}
        walletAddress={address || undefined}
      />
    </>
  )
}

