import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setLastShownVersion } from "@/lib/releaseNotes"

interface AdminModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminModal({ open, onOpenChange }: AdminModalProps) {
  const [version, setVersion] = useState("")

  const handleApply = () => {
    if (!version.trim()) return
    // Force the last shown version in localStorage
    setLastShownVersion(version.trim())
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setVersion("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Tools</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Force lastShownVersion</div>
            <p className="text-xs text-muted-foreground">
              Set the stored release-notes version in localStorage. This controls which
              release notes are considered already shown.
            </p>
            <Input
              placeholder="e.g. 0.25.0"
              value={version}
              onChange={e => setVersion(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!version.trim()}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


