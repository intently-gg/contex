import { create } from "zustand"
import { persist } from "zustand/middleware"
import { bigintReplacer } from "@/lib/utils"

interface ABIStore {
  abis: Record<string, unknown> // key is GUID
  abiLabels: Record<string, string> // key is GUID, value is label
  setABIs: (abis: Record<string, unknown>) => void
  addABI: (label: string, content: unknown) => string // returns GUID
  deleteABI: (abiKey: string) => void
  setABILabels: (labels: Record<string, string>) => void
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
      abiLabels: {},

      setABIs: (abis) => set({ abis }),

      generateGUID: () => generateUUID(),

      addABI: (label, content) => {
        const guid = generateUUID()
        set((state) => ({
          abis: {
            ...state.abis,
            [guid]: content,
          },
          abiLabels: {
            ...state.abiLabels,
            [guid]: label,
          },
        }))
        return guid
      },

      deleteABI: (abiKey) =>
        set((state) => {
          const newAbis = { ...state.abis }
          delete newAbis[abiKey]
          const newLabels = { ...state.abiLabels }
          delete newLabels[abiKey]
          return {
            abis: newAbis,
            abiLabels: newLabels,
          }
        }),

      setABILabels: (labels) => set({ abiLabels: labels }),

      setABILabel: (abiKey, label) =>
        set((state) => ({
          abiLabels: {
            ...state.abiLabels,
            [abiKey]: label,
          },
        })),

      getABIKeyByLabel: (label) => {
        const state = get()
        for (const [key, value] of Object.entries(state.abiLabels)) {
          if (value === label) {
            return key
          }
        }
        return undefined
      },

      isLabelUnique: (label, excludeKey) => {
        const state = get()
        for (const [key, value] of Object.entries(state.abiLabels)) {
          if (value === label && key !== excludeKey) {
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
        abiLabels: state.abiLabels,
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

