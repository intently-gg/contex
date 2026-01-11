import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Address } from "viem"
import type { ContractsRegistry } from "@/lib/contractRegistry"
import { bigintReplacer } from "@/lib/utils"

interface ReadResult {
  value: unknown
  timestamp: number
}

interface FormState {
  [abiKey: string]: {
    [functionName: string]: Record<string, unknown>
  }
}

interface ContractStore {
  contracts: ContractsRegistry
  selectedContract: string | null
  selectedFunction: Record<string, string | null> // contractLabel -> functionName
  selectedAddresses: Record<string, number>
  readResults: Record<string, ReadResult>
  formState: FormState
  initializeFormState: () => void
  favorites: Record<string, string[]>
  setContracts: (contracts: ContractsRegistry) => void
  setSelectedContract: (contractLabel: string | null) => void
  setSelectedFunction: (contractLabel: string, functionName: string | null) => void
  getSelectedFunction: (contractLabel: string) => string | null
  setSelectedAddress: (contractLabel: string, addressIndex: number) => void
  setReadResult: (
    contractLabel: string,
    chainId: number,
    functionName: string,
    address: Address,
    value: unknown
  ) => void
  getReadResult: (
    contractLabel: string,
    chainId: number,
    functionName: string,
    address: Address
  ) => ReadResult | undefined
  setFormState: (
    abiKey: string,
    functionName: string,
    inputs: Record<string, unknown>
  ) => void
  getFormState: (
    abiKey: string,
    functionName: string
  ) => Record<string, unknown> | undefined
  toggleFavorite: (contractLabel: string, functionName: string) => void
  isFavorite: (contractLabel: string, functionName: string) => boolean
  clearReadResultsForContract: (contractLabel: string) => void
}

function getResultKey(
  contractLabel: string,
  chainId: number,
  functionName: string,
  address: Address
): string {
  return `${contractLabel}:${chainId}:${functionName}:${address}`
}

export const useContractStore = create<ContractStore>()(
  persist(
    (set, get) => ({
      contracts: {},
      selectedContract: null,
      selectedFunction: {},
      selectedAddresses: {},
      readResults: {},
      formState: {},
      favorites: {},

      setContracts: (contracts) => set({ contracts }),

      setSelectedContract: (contractLabel) =>
        set({ selectedContract: contractLabel }),
      
      setSelectedFunction: (contractLabel, functionName) =>
        set((state) => ({
          selectedFunction: {
            ...state.selectedFunction,
            [contractLabel]: functionName,
          },
        })),
      
      getSelectedFunction: (contractLabel) => {
        return get().selectedFunction[contractLabel] ?? null
      },

      setSelectedAddress: (contractLabel, addressIndex) =>
        set((state) => ({
          selectedAddresses: {
            ...state.selectedAddresses,
            [contractLabel]: addressIndex,
          },
        })),

      setReadResult: (
        contractLabel,
        chainId,
        functionName,
        address,
        value
      ) => {
        const key = getResultKey(contractLabel, chainId, functionName, address)
        // Serialize value to handle BigInt
        const serializedValue = JSON.parse(JSON.stringify(value, bigintReplacer))
        set((state) => ({
          readResults: {
            ...state.readResults,
            [key]: {
              value: serializedValue,
              timestamp: Date.now(),
            },
          },
        }))
      },

      getReadResult: (contractLabel, chainId, functionName, address) => {
        const key = getResultKey(contractLabel, chainId, functionName, address)
        return get().readResults[key]
      },

      clearReadResultsForContract: (contractLabel) => {
        console.debug('[contractStore] Clearing cache for contract', {
          contractLabel,
          totalResultsBefore: Object.keys(get().readResults).length,
        })
        set((state) => {
          const newReadResults: Record<string, any> = {}
          let clearedCount = 0
          for (const [key, value] of Object.entries(state.readResults)) {
            // Only keep results that don't match this contract label
            if (!key.startsWith(`${contractLabel}:`)) {
              newReadResults[key] = value
            } else {
              clearedCount++
            }
          }
          console.debug('[contractStore] Cache cleared', {
            contractLabel,
            clearedCount,
            remainingResults: Object.keys(newReadResults).length,
          })
          return { readResults: newReadResults }
        })
      },

      setFormState: (abiKey, functionName, inputs) => {
        set((state) => {
          const newFormState = {
            ...state.formState,
            [abiKey]: {
              ...state.formState[abiKey],
              [functionName]: inputs,
            },
          }
          // Also save to sessionStorage
          try {
            sessionStorage.setItem(
              "contract-explorer-form-state",
              JSON.stringify(newFormState, bigintReplacer)
            )
          } catch (e) {
            console.warn("Failed to save form state to sessionStorage", e)
          }
          return { formState: newFormState }
        })
      },

      getFormState: (abiKey, functionName) => {
        // Try to load from sessionStorage first
        try {
          const stored = sessionStorage.getItem("contract-explorer-form-state")
          if (stored) {
            const parsed = JSON.parse(stored)
            return parsed[abiKey]?.[functionName]
          }
        } catch (e) {
          console.warn("Failed to load form state from sessionStorage", e)
        }
        // Fallback to in-memory state
        return get().formState[abiKey]?.[functionName]
      },

      toggleFavorite: (contractLabel, functionName) =>
        set((state) => {
          const contractFavorites = state.favorites[contractLabel] || []
          const isFav = contractFavorites.includes(functionName)
          return {
            favorites: {
              ...state.favorites,
              [contractLabel]: isFav
                ? contractFavorites.filter((f) => f !== functionName)
                : [...contractFavorites, functionName],
            },
          }
        }),

      isFavorite: (contractLabel, functionName) => {
        return (
          get().favorites[contractLabel]?.includes(functionName) ?? false
        )
      },

      initializeFormState: () => {
        // Load formState from sessionStorage on init
        try {
          const stored = sessionStorage.getItem("contract-explorer-form-state")
          if (stored) {
            const parsed = JSON.parse(stored)
            set({ formState: parsed })
          }
        } catch (e) {
          console.warn("Failed to initialize form state from sessionStorage", e)
        }
      },
    }),
    {
      name: "contract-explorer-storage",
      partialize: (state) => ({
        selectedContract: state.selectedContract,
        selectedAddresses: state.selectedAddresses,
        selectedFunction: state.selectedFunction,
        readResults: state.readResults,
        // Don't persist formState - it will use sessionStorage separately
        favorites: state.favorites,
        contracts: state.contracts,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          return JSON.parse(str, (_key, value) => {
            // Handle BigInt deserialization if needed
            if (typeof value === "string" && /^\d+n$/.test(value)) {
              return BigInt(value.slice(0, -1))
            }
            return value
          })
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value, bigintReplacer))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
    }
  )
)

