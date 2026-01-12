import { useEffect, useState } from "react"
import { checkAuth, purgeStorageAndStampVersion } from "@/lib/authCheck"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function AuthCheck({ children }: { children: React.ReactNode }) {
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const result = checkAuth()
    
    if (result.requiresUserAction) {
      setShowUpgradeAlert(true)
    } else {
      setIsAuthorized(true)
    }
  }, [])

  const handleUpgradeConfirm = () => {
    purgeStorageAndStampVersion()
    setShowUpgradeAlert(false)
    setIsAuthorized(true)
  }

  // Don't render children until authorized
  if (!isAuthorized) {
    return (
      <>
        <AlertDialog 
          open={showUpgradeAlert} 
          onOpenChange={(open) => {
            // Prevent closing without clicking OK - only allow opening
            if (open) {
              setShowUpgradeAlert(true)
            }
            // If open is false, ignore it - user must click OK
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>contex Version Upgrade</AlertDialogTitle>
              <AlertDialogDescription>
                contex version has been upgraded and you must re-import and re-configure your contracts.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleUpgradeConfirm}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return <>{children}</>
}

