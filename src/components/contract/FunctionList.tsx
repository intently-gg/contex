import { useState, useMemo } from "react"
import { useContractStore } from "@/stores/contractStore"
import { useABIStore } from "@/stores/abiStore"
import { parseABI } from "@/lib/abiParser"
import { ReadFunction } from "./ReadFunction"
import { WriteFunction } from "./WriteFunction"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { Address, Abi } from "viem"

interface FunctionListProps {
  abiKey: string
  address: Address
  supportedChainIds: number[]
}

export function FunctionList({
  abiKey,
  address,
  supportedChainIds,
}: FunctionListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { isFavorite } = useContractStore()
  const { abis } = useABIStore()

  const abi = abis[abiKey]?.abi as Abi | undefined
  
  const allFunctions = useMemo(() => {
    if (!abi) return []
    const parsed = parseABI(abi)
    return parsed || []
  }, [abi])

  const readFunctions = useMemo(() => {
    return allFunctions.filter((f) => f.type === "read")
  }, [allFunctions])

  const writeFunctions = useMemo(() => {
    return allFunctions.filter((f) => f.type === "write")
  }, [allFunctions])

  const filteredReadFunctions = useMemo(() => {
    if (!searchQuery) return readFunctions
    const query = searchQuery.toLowerCase()
    return readFunctions.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.inputs.some((input) =>
          (input.name || "").toLowerCase().includes(query)
        )
    )
  }, [readFunctions, searchQuery])

  const filteredWriteFunctions = useMemo(() => {
    if (!searchQuery) return writeFunctions
    const query = searchQuery.toLowerCase()
    return writeFunctions.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.inputs.some((input) =>
          (input.name || "").toLowerCase().includes(query)
        )
    )
  }, [writeFunctions, searchQuery])

  const favoriteReadFunctions = filteredReadFunctions.filter((f) =>
    isFavorite(abiKey, f.name)
  )
  const favoriteWriteFunctions = filteredWriteFunctions.filter((f) =>
    isFavorite(abiKey, f.name)
  )

  const regularReadFunctions = filteredReadFunctions.filter(
    (f) => !isFavorite(abiKey, f.name)
  )
  const regularWriteFunctions = filteredWriteFunctions.filter(
    (f) => !isFavorite(abiKey, f.name)
  )

  if (!abi) {
    return <div>Loading ABI...</div>
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search functions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-md p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        <div className="space-y-6">
          {readFunctions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Read Functions</h3>
              {favoriteReadFunctions.length > 0 && (
                <div className="space-y-2">
                  {favoriteReadFunctions.map((func) => (
                    <ReadFunction
                      key={func.name}
                      abiKey={abiKey}
                      address={address}
                      abi={abi}
                      function={func}
                      supportedChainIds={supportedChainIds}
                    />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {regularReadFunctions.map((func) => (
                  <ReadFunction
                    key={func.name}
                    abiKey={abiKey}
                    address={address}
                    abi={abi}
                    function={func}
                    supportedChainIds={supportedChainIds}
                  />
                ))}
              </div>
            </div>
          )}

          {writeFunctions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Write Functions</h3>
              {favoriteWriteFunctions.length > 0 && (
                <div className="space-y-2">
                  {favoriteWriteFunctions.map((func) => (
                    <WriteFunction
                      key={func.name}
                      abiKey={abiKey}
                      address={address}
                      abi={abi}
                      function={func}
                      supportedChainIds={supportedChainIds}
                    />
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {regularWriteFunctions.map((func) => (
                  <WriteFunction
                    key={func.name}
                    abiKey={abiKey}
                    address={address}
                    abi={abi}
                    function={func}
                    supportedChainIds={supportedChainIds}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

