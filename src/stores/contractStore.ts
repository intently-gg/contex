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

interface EncodeDestination {
  abiKey: string
  functionId: string
  paramIndex: number
  timestamp: number
}

interface ContractStore {
  contracts: ContractsRegistry
  selectedAbiKey: string | null
  selectedFunction: Record<string, string | null> // abiKey -> functionName
  selectedAddresses: Record<string, number> // abiKey -> addressIndex
  readResults: Record<string, ReadResult>
  formState: FormState
  initializeFormState: () => void
  favorites: Record<string, string[]> // abiKey -> functionName[]
  encodeDestinations: EncodeDestination[]
  setContracts: (contracts: ContractsRegistry) => void
  setSelectedAbiKey: (abiKey: string | null) => void
  setSelectedFunction: (abiKey: string, functionName: string | null) => void
  getSelectedFunction: (abiKey: string) => string | null
  setSelectedAddress: (abiKey: string, addressIndex: number) => void
  setReadResult: (
    abiKey: string,
    chainId: number,
    functionName: string,
    address: Address,
    value: unknown
  ) => void
  getReadResult: (
    abiKey: string,
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
  toggleFavorite: (abiKey: string, functionName: string) => void
  isFavorite: (abiKey: string, functionName: string) => boolean
  clearReadResultsForContract: (abiKey: string) => void
  addEncodeDestination: (destination: Omit<EncodeDestination, "timestamp">) => void
  getRecentEncodeDestinations: () => EncodeDestination[]
}

function getResultKey(
  abiKey: string,
  chainId: number,
  functionName: string,
  address: Address
): string {
  return `${abiKey}:${chainId}:${functionName}:${address}`
}

export const useContractStore = create<ContractStore>()(
  persist(
    (set, get) => ({
      contracts: {},
      selectedAbiKey: null,
      selectedFunction: {},
      selectedAddresses: {},
      readResults: {},
      formState: {},
      favorites: {},
      encodeDestinations: [],

      setContracts: (contracts) => set({ contracts }),

      setSelectedAbiKey: (abiKey) =>
        set({ selectedAbiKey: abiKey }),
      
      setSelectedFunction: (abiKey, functionName) =>
        set((state) => ({
          selectedFunction: {
            ...state.selectedFunction,
            [abiKey]: functionName,
          },
        })),
      
      getSelectedFunction: (abiKey) => {
        return get().selectedFunction[abiKey] ?? null
      },

      setSelectedAddress: (abiKey, addressIndex) =>
        set((state) => ({
          selectedAddresses: {
            ...state.selectedAddresses,
            [abiKey]: addressIndex,
          },
        })),

      setReadResult: (
        abiKey,
        chainId,
        functionName,
        address,
        value
      ) => {
        const key = getResultKey(abiKey, chainId, functionName, address)
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

      getReadResult: (abiKey, chainId, functionName, address) => {
        const key = getResultKey(abiKey, chainId, functionName, address)
        return get().readResults[key]
      },

      clearReadResultsForContract: (abiKey) => {
        set((state) => {
          const newReadResults: Record<string, any> = {}
          for (const [key, value] of Object.entries(state.readResults)) {
            // Only keep results that don't match this abiKey
            if (!key.startsWith(`${abiKey}:`)) {
              newReadResults[key] = value
            }
          }
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

      toggleFavorite: (abiKey, functionName) =>
        set((state) => {
          const contractFavorites = state.favorites[abiKey] || []
          const isFav = contractFavorites.includes(functionName)
          return {
            favorites: {
              ...state.favorites,
              [abiKey]: isFav
                ? contractFavorites.filter((f) => f !== functionName)
                : [...contractFavorites, functionName],
            },
          }
        }),

      isFavorite: (abiKey, functionName) => {
        return (
          get().favorites[abiKey]?.includes(functionName) ?? false
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

      addEncodeDestination: (destination) => {
        const now = Date.now()
        set((state) => {
          const newDestinations = [
            { ...destination, timestamp: now },
            ...state.encodeDestinations.filter(
              (d) =>
                d.abiKey !== destination.abiKey ||
                d.functionId !== destination.functionId ||
                d.paramIndex !== destination.paramIndex
            ),
          ]
          return { encodeDestinations: newDestinations }
        })
      },

      getRecentEncodeDestinations: () => {
        const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
        return get()
          .encodeDestinations.filter((d) => d.timestamp >= fiveDaysAgo)
          .sort((a, b) => b.timestamp - a.timestamp)
      },
    }),
    {
      name: "contract-explorer-storage",
      partialize: (state) => ({
        selectedAbiKey: state.selectedAbiKey,
        selectedAddresses: state.selectedAddresses,
        selectedFunction: state.selectedFunction,
        readResults: state.readResults,
        // Don't persist formState - it will use sessionStorage separately
        favorites: state.favorites,
        contracts: state.contracts,
        encodeDestinations: state.encodeDestinations,
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

