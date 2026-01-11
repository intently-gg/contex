import type { Abi, Address } from "viem"

export interface ABIEntry {
  filename: string
  abi: Abi
  name?: string
}

export interface ContractConfig {
  contractLabel: string
  abiKey: string
  address: Address
  addressLabel: string
  chainIds: number[]
}

