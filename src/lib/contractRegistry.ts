import type { Address } from "viem"
import { safeStringify } from "@/lib/utils"

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

const CONTRACTS_FILE = "/contracts.json"

export async function loadContracts(): Promise<ContractsRegistry> {
  try {
    const response = await fetch(CONTRACTS_FILE)
    if (!response.ok) {
      return {}
    }
    return await response.json()
  } catch {
    return {}
  }
}

export async function saveContracts(
  contracts: ContractsRegistry
): Promise<void> {
  try {
      await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify(contracts, 2),
      })
  } catch (error) {
    console.error("Failed to save contracts:", error)
    throw error
  }
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
    newContracts[contractLabel].addresses[addressIndex].label = newLabel
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

