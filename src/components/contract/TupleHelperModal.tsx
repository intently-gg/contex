import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TupleHelper } from "./TupleHelper"
import type { AbiParameter } from "viem"

interface TupleHelperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (value: string) => void
  fieldName: string
  abiParam: AbiParameter
  currentValue?: string
  onTupleHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onListHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  onBytesHelper?: (fieldName: string, abiParam: AbiParameter, currentValue?: string) => void
  abiKey?: string
  address?: string
  functionName?: string
}

export function TupleHelperModal({
  open,
  onOpenChange,
  onApply,
  fieldName,
  abiParam,
  currentValue = "",
  onTupleHelper,
  onListHelper,
  onBytesHelper,
  abiKey,
  address,
  functionName,
}: TupleHelperModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tuple Helper</DialogTitle>
          <DialogDescription>Configure {fieldName} tuple values</DialogDescription>
        </DialogHeader>
        <TupleHelper
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
