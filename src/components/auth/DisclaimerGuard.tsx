import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { DisclaimerModal } from "./DisclaimerModal"
import { SigningError } from "./SigningError"
import { checkDisclaimerSignature, signDisclaimer } from "@/lib/disclaimer"

interface DisclaimerGuardProps {
  children: React.ReactNode
}

export function DisclaimerGuard({ children }: DisclaimerGuardProps) {
  const { address, isConnected } = useAccount()
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [signingError, setSigningError] = useState<string | null>(null)
  const [isSigned, setIsSigned] = useState(false)

  useEffect(() => {
    async function checkSignature() {
      if (!isConnected || !address) {
        setIsChecking(false)
        return
      }

      try {
        const result = await checkDisclaimerSignature(address)
        if (result.signed) {
          setIsSigned(true)
        } else {
          setShowDisclaimer(true)
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

    try {
      const success = await signDisclaimer(address)
      if (success) {
        setShowDisclaimer(false)
        setIsSigned(true)
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
  }

  const handleRetry = () => {
    setSigningError(null)
    if (isConnected && address) {
      setShowDisclaimer(true)
    }
  }

  if (isChecking) {
    return null
  }

  if (signingError) {
    return <SigningError onRetry={handleRetry} error={signingError} />
  }

  if (!isSigned && isConnected && address) {
    return (
      <>
        <DisclaimerModal
          open={showDisclaimer}
          onAgree={handleAgree}
          onDecline={handleDecline}
          walletAddress={address}
        />
        <div className="h-screen w-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground">Please wait...</div>
        </div>
      </>
    )
  }

  return <>{children}</>
}

