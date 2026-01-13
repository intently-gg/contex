import { create } from "zustand"
import { persist } from "zustand/middleware"
import { bigintReplacer } from "@/lib/utils"

export interface ABIEntry {
  label: string
  abi: unknown
}

interface ABIStore {
  abis: Record<string, ABIEntry> // key is GUID, value is { label, abi }
  setABIs: (abis: Record<string, ABIEntry>) => void
  addABI: (label: string, content: unknown) => string // returns GUID
  deleteABI: (abiKey: string) => void
  setABILabel: (abiKey: string, label: string) => void
  getABIKeyByLabel: (label: string) => string | undefined
  isLabelUnique: (label: string, excludeKey?: string) => boolean
  generateGUID: () => string
}

function generateUUID(): string {
  // Try crypto.randomUUID() first (modern browsers and Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const useABIStore = create<ABIStore>()(
  persist(
    (set, get) => ({
      abis: {},

      setABIs: (abis) => set({ abis }),

      generateGUID: () => generateUUID(),

      addABI: (label, content) => {
        const guid = generateUUID()
        set((state) => ({
          abis: {
            ...state.abis,
            [guid]: {
              label,
              abi: content,
            },
          },
        }))
        return guid
      },

      deleteABI: (abiKey) =>
        set((state) => {
          const newAbis = { ...state.abis }
          delete newAbis[abiKey]
          return {
            abis: newAbis,
          }
        }),

      setABILabel: (abiKey, label) =>
        set((state) => {
          if (!state.abis[abiKey]) {
            return state
          }
          return {
            abis: {
              ...state.abis,
              [abiKey]: {
                ...state.abis[abiKey],
                label,
              },
            },
          }
        }),

      getABIKeyByLabel: (label) => {
        const state = get()
        for (const [key, entry] of Object.entries(state.abis)) {
          if (entry.label === label) {
            return key
          }
        }
        return undefined
      },

      isLabelUnique: (label, excludeKey) => {
        const state = get()
        for (const [key, entry] of Object.entries(state.abis)) {
          if (entry.label === label && key !== excludeKey) {
            return false
          }
        }
        return true
      },
    }),
    {
      name: "abi-storage",
      partialize: (state) => ({
        abis: state.abis,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          return JSON.parse(str, (_key, value) => {
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

