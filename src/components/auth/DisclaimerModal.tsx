import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const DISCLAIMER_TEXT = `By using contex, you acknowledge it is an experimental beta feature provided 'as is' by intently [INTENTLY LLC]. We disclaim all warranties and assume no liability for any loss of funds, smart contract failures, or damages resulting from your use. You acknowledge that blockchain transactions are irreversible and that you are solely responsible for your own assets and risk. Use of contex does not constitute financial advice.`

interface DisclaimerModalProps {
  open: boolean
  onAgree: () => void
  onDecline: () => void
  walletAddress?: string
}

export function DisclaimerModal({ open, onAgree, onDecline, walletAddress }: DisclaimerModalProps) {
  return (
    <AlertDialog 
      open={open} 
      onOpenChange={(open) => {
        if (!open) {
          onDecline()
        }
      }}
    >
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Disclaimer
            {walletAddress && (
              <div className="text-sm font-normal text-muted-foreground mt-1 font-mono">
                {walletAddress}
              </div>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-left">
            {DISCLAIMER_TEXT}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>
            DECLINE
          </AlertDialogCancel>
          <AlertDialogAction onClick={onAgree}>
            I AGREE
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DISCLAIMER_TEXT }

