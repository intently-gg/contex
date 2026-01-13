import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { ReadFunction } from "./ReadFunction"
import { WriteFunction } from "./WriteFunction"
import { parseABI } from "@/lib/abiParser"
import type { Address, Abi } from "viem"

interface SelectedFunctionViewProps {
  abiKey: string
  address: Address
  abi: Abi
  functionName: string | null
  supportedChainIds: number[]
  refreshKey?: number
  onBack?: () => void
}

export function SelectedFunctionView({
  abiKey,
  address,
  abi,
  functionName,
  supportedChainIds,
  refreshKey,
  onBack: _onBack,
}: SelectedFunctionViewProps) {

  const allFunctions = useMemo(() => {
    const parsed = parseABI(abi)
    return parsed || []
  }, [abi])
  
  const selectedFunc = useMemo(() => 
    allFunctions.find((f) => f.name === functionName),
    [allFunctions, functionName]
  )

  if (!functionName || !selectedFunc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ transform: "scaleX(-1)" }} />
          <span className="text-lg">Select a function to get started.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: '1125px' }}>
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFunc.type === "read" ? (
          <ReadFunction
            abiKey={abiKey}
            address={address}
            abi={abi}
            function={selectedFunc}
            supportedChainIds={supportedChainIds}
            refreshKey={refreshKey}
          />
        ) : (
          <WriteFunction
            abiKey={abiKey}
            address={address}
            abi={abi}
            function={selectedFunc}
            supportedChainIds={supportedChainIds}
          />
        )}
      </div>

    </div>
  )
}

