export const CONTEX_VERSION = "0.26.2"

export interface RegisteredAddress {
  label: string
  type: string
  address: string
  chainIds: number[] | "ALL"
}

/** Expected on-chain symbol() values per asset label (used by verify-assets script). */
export const ASSET_EXPECTED_SYMBOLS: Record<string, string[]> = {
  USDC: ["USDC", "USDC.e", "USDzC"],
  WETH: ["WETH", "ETH"],
  USDT: ["USDT", "USDT0", "USD₮0"],
}

/** Populate from script: pnpm run verify-assets. App will not start if hash does not match. */
/* this hash proves that our current default registered assets have been confirmed on-chain.. to minimize risk of a configuration mistake */
export const ASSETS_VERIFIED_HASH: string = "0x496ef114e8d3415afd73ccf50e617aa0c5c1692ff1c6d17169eae1e7051ad39a"

/** Salt used when hashing asset payload (must match scripts/verify-assets.ts). */
export const ASSETS_VERIFICATION_SALT = "VERIFIED"

/** Deterministic payload for assets verification hash (used by script and app). */
export function getAssetsVerificationPayload(assets: RegisteredAddress[]): string {
  const list = assets
    .filter((a) => a.type === "Asset")
    .map((a) => ({
      label: a.label,
      address: a.address.toLowerCase(),
      chainIds: a.chainIds === "ALL" ? "ALL" : [...a.chainIds].sort((x, y) => x - y),
    }))
    .sort((a, b) => {
      if (a.label !== b.label) return a.label.localeCompare(b.label)
      if (a.address !== b.address) return a.address.localeCompare(b.address)
      const ac = String(a.chainIds)
      const bc = String(b.chainIds)
      return ac.localeCompare(bc)
    })
  return JSON.stringify(list)
}

export const DEFAULT_REGISTERED_ADDRESSES: RegisteredAddress[] = [
  // USDC
  { label: "USDC", type: "Asset", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainIds: [1] },
  { label: "USDC", type: "Asset", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", chainIds: [10] },
  { label: "USDC", type: "Asset", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", chainIds: [137] },
  { label: "USDC", type: "Asset", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", chainIds: [42161] },
  { label: "USDC", type: "Asset", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chainIds: [8453] },
  { label: "USDC", type: "Asset", address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6", chainIds: [130] },
  { label: "USDC", type: "Asset", address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", chainIds: [56] },
  { label: "USDC", type: "Asset", address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", chainIds: [59144] },
  { label: "USDC", type: "Asset", address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4", chainIds: [324] },
  { label: "USDC", type: "Asset", address: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", chainIds: [480] },
  { label: "USDC", type: "Asset", address: "0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369", chainIds: [1868] },
  { label: "USDC", type: "Asset", address: "0x754704bc059f8c67012fed69bc8a327a5aafb603", chainIds: [143] },
  { label: "USDC", type: "Asset", address: "0xd988097fb8612cc24eeC14542bC03424c656005f", chainIds: [34443] },
  { label: "USDC", type: "Asset", address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", chainIds: [534352] },
  { label: "USDC", type: "Asset", address: "0xCccCCccc7021b32EBb4e8C08314bD62F7c653EC4", chainIds: [7777777] },
  { label: "USDC", type: "Asset", address: "0xb88339cb7199b77e23db6e890353e22632ba630f", chainIds: [999] },
  { label: "USDC", type: "Asset", address: "0x2D270e6886d130D724215A266106e6832161EAEd", chainIds: [57073] },
  // WETH
  { label: "WETH", type: "Asset", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", chainIds: [1] },
  { label: "WETH", type: "Asset", address: "0x4200000000000000000000000000000000000006", chainIds: [10, 8453, 130, 480, 1868, 34443, 7777777, 57073] },
  { label: "WETH", type: "Asset", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", chainIds: [42161] },
  { label: "WETH", type: "Asset", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", chainIds: [137] },
  { label: "WETH", type: "Asset", address: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", chainIds: [56] },
  { label: "WETH", type: "Asset", address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", chainIds: [59144] },
  { label: "WETH", type: "Asset", address: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91", chainIds: [324] },
  { label: "WETH", type: "Asset", address: "0x5300000000000000000000000000000000000004", chainIds: [534352] },
  // USDT
  { label: "USDT", type: "Asset", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chainIds: [1] },
  { label: "USDT", type: "Asset", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", chainIds: [10] },
  { label: "USDT", type: "Asset", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", chainIds: [42161] },
  { label: "USDT", type: "Asset", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", chainIds: [8453] },
  { label: "USDT", type: "Asset", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", chainIds: [137] },
  { label: "USDT", type: "Asset", address: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C", chainIds: [324] },
  { label: "USDT", type: "Asset", address: "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb", chainIds: [9745] },
  { label: "USDT", type: "Asset", address: "0x55d398326f99059ff775485246999027b3197955", chainIds: [56] },
]

export const RELEASE_NOTES = {
  "0.26": {
    "whatsnew": {
      "Import Calldata": [
        "Raw calldata can be imported into any function's parameters",
        "Transaction hashes can be supplied to clone any on-chain tx"
      ],
      "Integer Helper": [
        "New tool available from the top-right Menu and on any integer input param",
        "Parse uint/int values from decimals and units",
        "Now Supports Unix Seconds, Chain Ids, Block Numbers, and Block Timestamps"
      ],
    },
  },
  "0.25": {
    "whatsnew": {
      "Function Encoding": [
        "Functions can now be encoded to a Clipboard or to another function's bytes parameter",
        "bytes[] params can also receive encoded bytes, with a prompt to select the list position",
        "This can be used to construct complex multicalls"
      ],
      "Bytes Helper": [
        "Allows decoding, viewing, & editing of bytes fields",
        "Enabled for any bytes input param whose function is registered somewhere in contex",
        "Activated by clicking the Helper button on enabled bytes input params"
      ],
      "Hex Converter": [
        "New tool available from the top-right Menu",
        "Convert easily between hex bytes, integers, and strings"
      ],
      "Function Viewer": [
        "'Show Function JSON' button added",
      ],
      "General": [
        "Function overloads now supported",
      ],
    },
  },
}



// 🚨🚨🚨 DO NOT CHANGE THIS UNLESS WE ABSOLUTELY NEED TO FORCE USERS TO WIPE OUT THEIR LOCAL STORAGE
// 🚨🚨🚨 DO NOT CHANGE THIS UNLESS WE ABSOLUTELY NEED TO FORCE USERS TO WIPE OUT THEIR LOCAL STORAGE
export const CONTEX_CONFIG_VERSION = "0.14" 
// 🚨🚨🚨 DO NOT CHANGE THIS UNLESS WE ABSOLUTELY NEED TO FORCE USERS TO WIPE OUT THEIR LOCAL STORAGE
// 🚨🚨🚨 DO NOT CHANGE THIS UNLESS WE ABSOLUTELY NEED TO FORCE USERS TO WIPE OUT THEIR LOCAL STORAGE
