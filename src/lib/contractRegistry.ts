import type { Address } from "viem"

export interface ContractAddress {
  address: Address
  label: string
  chainIds: number[]
}

export interface ContractEntry {
  abi: string
  addresses: ContractAddress[]
}

export interface ContractsRegistry {
  [contractLabel: string]: ContractEntry
}

export async function saveContracts(
  contracts: ContractsRegistry
): Promise<void> {
  // Contracts are stored in localStorage via the contractStore's persist middleware.
  // This function is kept for API compatibility, but the actual persistence happens
  // automatically when setContracts() is called on the store.
  // No-op since the store handles persistence automatically.
}

export function addContract(
  contracts: ContractsRegistry,
  contractLabel: string,
  abi: string,
  address: Address,
  addressLabel: string,
  chainIds: number[]
): ContractsRegistry {
  const newContracts = { ...contracts }

  if (!newContracts[contractLabel]) {
    newContracts[contractLabel] = {
      abi,
      addresses: [],
    }
  }

  newContracts[contractLabel].addresses.push({
    address,
    label: addressLabel,
    chainIds,
  })

  return newContracts
}

export function updateContractLabel(
  contracts: ContractsRegistry,
  oldLabel: string,
  newLabel: string
): ContractsRegistry {
  if (oldLabel === newLabel || !contracts[oldLabel]) {
    return contracts
  }

  const newContracts = { ...contracts }
  newContracts[newLabel] = newContracts[oldLabel]
  delete newContracts[oldLabel]
  return newContracts
}

export function updateAddressLabel(
  contracts: ContractsRegistry,
  contractLabel: string,
  addressIndex: number,
  newLabel: string
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[contractLabel]?.addresses[addressIndex]) {
    newContracts[contractLabel] = {
      ...newContracts[contractLabel],
      addresses: newContracts[contractLabel].addresses.map((addr, idx) =>
        idx === addressIndex ? { ...addr, label: newLabel } : addr
      ),
    }
  }
  return newContracts
}

export function deleteContract(
  contracts: ContractsRegistry,
  contractLabel: string
): ContractsRegistry {
  const newContracts = { ...contracts }
  delete newContracts[contractLabel]
  return newContracts
}

export function deleteAddress(
  contracts: ContractsRegistry,
  contractLabel: string,
  addressIndex: number
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[contractLabel]) {
    newContracts[contractLabel].addresses = newContracts[
      contractLabel
    ].addresses.filter((_, i) => i !== addressIndex)
    if (newContracts[contractLabel].addresses.length === 0) {
      delete newContracts[contractLabel]
    }
  }
  return newContracts
}

export function updateAddressChainIds(
  contracts: ContractsRegistry,
  contractLabel: string,
  addressIndex: number,
  chainIds: number[]
): ContractsRegistry {
  const newContracts = { ...contracts }
  if (newContracts[contractLabel]?.addresses[addressIndex]) {
    newContracts[contractLabel] = {
      ...newContracts[contractLabel],
      addresses: newContracts[contractLabel].addresses.map((addr, idx) =>
        idx === addressIndex ? { ...addr, chainIds } : addr
      ),
    }
  }
  return newContracts
}

