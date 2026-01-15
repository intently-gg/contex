import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WhatsNewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  releaseNotes: Record<string, { whatsnew: Record<string, string[]> }>
}

export function WhatsNewModal({ open, onOpenChange, releaseNotes }: WhatsNewModalProps) {
  const handleClose = () => {
    onOpenChange(false)
  }

  // Sort versions in descending order (newest first)
  const sortedVersions = Object.keys(releaseNotes).sort((a, b) => {
    const partsA = a.split(".").map(Number)
    const partsB = b.split(".").map(Number)
    const maxLength = Math.max(partsA.length, partsB.length)
    
    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] || 0
      const partB = partsB[i] || 0
      if (partB !== partA) {
        return partB - partA
      }
    }
    return 0
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Whats New?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {sortedVersions.map((version) => {
            const notes = releaseNotes[version]
            const sections = Object.entries(notes.whatsnew)

            return (
              <div key={version} className="space-y-3">
                <h3 className="font-semibold text-base">Version {version}</h3>
                {sections.map(([sectionTitle, items]) => (
                  <div key={sectionTitle} className="space-y-1">
                    <div className="text-sm font-medium">{sectionTitle}</div>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                      {items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

