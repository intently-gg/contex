import type { Address } from "viem"

export interface ContractAddress {
  address: Address
  label: string
  chainIds: number[]
}

export interface ContractsRegistry {
  [abiKey: string]: ContractAddress[]
}

export async function saveContracts(
  _contracts: ContractsRegistry
): Promise<void> {
  // Contracts are stored in localStorage via the contractStore's persist middleware.
  // This function is kept for API compatibility, but the actual persistence happens
  // automatically when setContracts() is called on the store.
  // No-op since the store handles persistence automatically.
}

export function addContract(
  contracts: ContractsRegistry,
  abiKey: string,
  address: Address,
  addressLabel: string,
  chainIds: number[]
): ContractsRegistry {
  const newContracts = { ...contracts }

  if (!newContracts[abiKey]) {
    newContracts[abiKey] = []
  }

  newContracts[abiKey].push({
    address,
    label: addressLabel,
    chainIds,
  })

  return newContracts
}

// Removed: updateContractLabel - labels are now stored in ABI store, not contracts

export function updateAddressLabel(
  contracts: ContractsRegistry,
  abiKey: string,
  address: Address,
  newLabel: string
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[abiKey]) {
    newContracts[abiKey] = newContracts[abiKey].map((addr) =>
      addr.address.toLowerCase() === address.toLowerCase()
        ? { ...addr, label: newLabel }
        : addr
    )
  }
  return newContracts
}

export function deleteContract(
  contracts: ContractsRegistry,
  abiKey: string
): ContractsRegistry {
  const newContracts = { ...contracts }
  delete newContracts[abiKey]
  return newContracts
}

export function deleteAddress(
  contracts: ContractsRegistry,
  abiKey: string,
  address: Address
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[abiKey]) {
    newContracts[abiKey] = newContracts[abiKey].filter(
      (addr) => addr.address.toLowerCase() !== address.toLowerCase()
    )
    if (newContracts[abiKey].length === 0) {
      delete newContracts[abiKey]
    }
  }
  return newContracts
}

export function updateAddressChainIds(
  contracts: ContractsRegistry,
  abiKey: string,
  address: Address,
  chainIds: number[]
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[abiKey]) {
    newContracts[abiKey] = newContracts[abiKey].map((addr) =>
      addr.address.toLowerCase() === address.toLowerCase()
        ? { ...addr, chainIds }
        : addr
    )
  }
  return newContracts
}

// Removed: updateContractABI - contracts are now keyed by abiKey directly

