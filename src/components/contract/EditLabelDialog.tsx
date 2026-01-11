import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EditLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLabel: string
  onSave: (newLabel: string) => void
  title: string
  description: string
}

export function EditLabelDialog({
  open,
  onOpenChange,
  currentLabel,
  onSave,
  title,
  description,
}: EditLabelDialogProps) {
  const [newLabel, setNewLabel] = useState(currentLabel)

  const handleSave = () => {
    const trimmed = newLabel.trim()
    if (trimmed) {
      if (trimmed.length > 75) {
        return
      }
      onSave(trimmed)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="label-input">Label</Label>
          <Input
            id="label-input"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={75}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

