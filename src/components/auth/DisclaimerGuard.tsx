import { useEffect, useState, useRef } from "react"
import { useAccount } from "wagmi"
import { SigningError } from "./SigningError"
import { checkDisclaimerSignature, signDisclaimer } from "@/lib/disclaimer"
import { DisclaimerDeclined } from "./DisclaimerDeclined"
import { Button } from "@/components/ui/button"
import { DISCLAIMER_TEXT } from "./DisclaimerModal"

interface DisclaimerGuardProps {
  children: React.ReactNode
}

export function DisclaimerGuard({ children }: DisclaimerGuardProps) {
  const { address, isConnected } = useAccount()
  const [isChecking, setIsChecking] = useState(true)
  const [signingError, setSigningError] = useState<string | null>(null)
  const [isSigned, setIsSigned] = useState(false)
  const [hasDeclined, setHasDeclined] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const hasDeclinedRef = useRef(false)

  const closeWalletModals = () => {
    const closeModal = () => {
      const dialogs = document.querySelectorAll('[role="dialog"]')
      dialogs.forEach(dialog => {
        const dialogElement = dialog as HTMLElement
        const isRainbowKit = dialogElement.querySelector('[data-rk]') || 
                           dialogElement.closest('[data-rk]') ||
                           dialogElement.textContent?.includes('Connect Wallet') ||
                           dialogElement.textContent?.includes('Choose your wallet')
        
        if (isRainbowKit) {
          const closeButton = dialogElement.querySelector('button[aria-label*="Close"], button[aria-label*="close"], button[aria-label="Close"]')
          if (closeButton) {
            ;(closeButton as HTMLButtonElement).click()
            return
          }
          const backdrop = dialogElement.closest('[data-radix-portal]') || 
                          dialogElement.closest('[data-rk]') ||
                          dialogElement.parentElement
          if (backdrop) {
            const escapeEvent = new KeyboardEvent('keydown', { 
              key: 'Escape', 
              code: 'Escape',
              keyCode: 27,
              bubbles: true,
              cancelable: true
            })
            backdrop.dispatchEvent(escapeEvent)
            dialogElement.dispatchEvent(escapeEvent)
          }
        }
      })
      const overlays = document.querySelectorAll('[data-radix-overlay], [data-rk]')
      overlays.forEach(overlay => {
        const overlayElement = overlay as HTMLElement
        if (overlayElement.style.display !== 'none' && overlayElement.offsetParent !== null) {
          const escapeEvent = new KeyboardEvent('keydown', { 
            key: 'Escape', 
            code: 'Escape',
            keyCode: 27,
            bubbles: true,
            cancelable: true
          })
          overlayElement.dispatchEvent(escapeEvent)
        }
      })
    }
    closeModal()
    setTimeout(closeModal, 50)
    setTimeout(closeModal, 150)
  }

  useEffect(() => {
    async function checkSignature() {
      if (!isConnected || !address) {
        setIsChecking(false)
        setHasDeclined(false)
        hasDeclinedRef.current = false
        return
      }

      try {
        const result = await checkDisclaimerSignature(address)
        if (result.signed) {
          setIsSigned(true)
          setHasDeclined(false)
          hasDeclinedRef.current = false
        } else {
          setIsSigned(false)
          if (!hasDeclinedRef.current && !hasDeclined) {
            closeWalletModals()
          }
        }
      } catch (error) {
        setSigningError("Failed to check status. Please refresh the page.")
      } finally {
        setIsChecking(false)
      }
    }

    checkSignature()
  }, [isConnected, address])

  const handleAgree = async () => {
    if (!address) return

    setIsSigning(true)

    try {
      const success = await signDisclaimer(address)
      if (success) {
        setIsSigned(true)
        setSigningError(null)
        window.location.reload()
      } else {
        throw new Error("Failed to sign disclaimer")
      }
    } catch (error) {
      setIsSigning(false)
      const errorMessage = error instanceof Error ? error.message : "Failed to sign disclaimer"
      setSigningError(errorMessage)
    }
  }

  const handleDecline = () => {
    hasDeclinedRef.current = true
    setHasDeclined(true)
    setIsSigned(false)
    setIsChecking(false)
  }

  const handleRetry = () => {
    setSigningError(null)
  }

  if (isChecking) {
    return null
  }

  if (isSigning) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Please wait...</div>
      </div>
    )
  }

  if (hasDeclined || hasDeclinedRef.current) {
    return <DisclaimerDeclined />
  }

  if (signingError) {
    return <SigningError onRetry={handleRetry} error={signingError} />
  }

  if (isConnected && address && !isSigned) {
    if (hasDeclinedRef.current) {
      return <DisclaimerDeclined />
    }
    
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background fixed inset-0 z-50 p-4">
        <div className="max-w-2xl w-full bg-background border border-border rounded-lg shadow-lg p-6 space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Disclaimer
            </h2>
            {address && (
              <div className="text-sm font-normal text-muted-foreground font-mono">
                {address}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {DISCLAIMER_TEXT}
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 pt-4">
            <Button
              variant="outline"
              onClick={handleDecline}
              className="w-full sm:w-auto"
            >
              DECLINE
            </Button>
            <Button
              onClick={handleAgree}
              className="w-full sm:w-auto"
            >
              I AGREE
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

