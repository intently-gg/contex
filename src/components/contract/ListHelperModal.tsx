import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ListHelper } from "./ListHelper"
import type { AbiParameter } from "viem"

interface ListHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  abiParam: AbiParameter
  currentValue?: string
  onValueHelper?: (fieldName: string) => void
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  abiKey?: string
  address?: string
  functionName?: string
}

export function ListHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  abiParam,
  currentValue = "",
  onValueHelper: _onValueHelper,
  onTupleHelper,
  onListHelper,
  onBytesHelper,
  abiKey,
  address,
  functionName,
}: ListHelperModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>List Helper</DialogTitle>
          <DialogDescription>Configure {fieldName} list values</DialogDescription>
        </DialogHeader>
        <ListHelper
          fieldName={fieldName}
          abiParam={abiParam}
          currentValue={currentValue}
          active={open}
          variant="modal"
          onApply={(serialized) => {
            onApply(serialized)
            onOpenChange(false)
          }}
          onModalCancel={() => onOpenChange(false)}
          onTupleHelper={onTupleHelper}
          onListHelper={onListHelper}
          onBytesHelper={onBytesHelper}
          abiKey={abiKey}
          address={address}
          functionName={functionName}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        />
      </DialogContent>
    </Dialog>
  )
}
