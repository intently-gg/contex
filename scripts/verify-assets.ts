/**
 * Verifies each Asset in DEFAULT_REGISTERED_ADDRESSES on-chain (eth_call symbol())
 * via a JSON-RPC compatible endpoint (roxy). Run: pnpm run verify-assets
 */
import axios from "axios"
import { keccak256, stringToHex } from "viem"

const roxyUrl = process.env.ROXY_URL ?? "http://localhost:2424"

const SYMBOL_SELECTOR = "0x95d89b41"

function decodeAbiString(hex: string): string {
  if (!hex || hex === "0x") return ""
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex
  if (raw.length < 64) return ""
  const offset = Number(BigInt("0x" + raw.slice(0, 64)))
  const offsetHex = offset * 2
  if (raw.length < offsetHex + 64) return ""
  const length = Number(BigInt("0x" + raw.slice(offsetHex, offsetHex + 64)))
  const dataStartHex = offsetHex + 64
  const dataHex = raw.slice(dataStartHex, dataStartHex + length * 2)
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(dataHex.slice(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

async function callSymbol(rpcUrl: string, address: string): Promise<string> {
  const { data } = await axios.post<{ result?: string }>(rpcUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: address, data: SYMBOL_SELECTOR }, "latest"],
  })
  const result = data.result
  if (typeof result !== "string") {
    throw new Error(result != null ? String(result) : "Missing result")
  }
  return decodeAbiString(result)
}

async function main() {
  console.log("verify-assets: loading config...")
  const {
    DEFAULT_REGISTERED_ADDRESSES,
    ASSET_EXPECTED_SYMBOLS,
    ASSETS_VERIFICATION_SALT,
    getAssetsVerificationPayload,
  } = await import("../src/lib/config.ts")

  const assets = DEFAULT_REGISTERED_ADDRESSES.filter((a) => a.type === "Asset")
  if (assets.length === 0) {
    console.error("No Asset entries in DEFAULT_REGISTERED_ADDRESSES")
    process.exit(1)
  }

  const toCheck: { label: string; address: string; chainId: number }[] = []
  for (const a of assets) {
    if (a.chainIds === "ALL") {
      console.error("Script does not support chainIds: 'ALL'. Use explicit chain IDs.")
      process.exit(1)
    }
    for (const cid of a.chainIds) {
      toCheck.push({ label: a.label, address: a.address, chainId: cid })
    }
  }

  console.log(`verify-assets: roxyUrl = ${roxyUrl}`)
  console.log(`verify-assets: checking ${toCheck.length} asset(s) across chains...`)
  console.log("")

  let failed = false
  let done = 0
  for (const { label, address, chainId } of toCheck) {
    const url = `${roxyUrl.replace(/\/$/, "")}/${chainId}`
    try {
      const symbol = await callSymbol(url, address)
      const expected = ASSET_EXPECTED_SYMBOLS[label]
      done++
      if (!expected || !expected.includes(symbol)) {
        console.error(
          `[${done}/${toCheck.length}] FAIL ${label} @ ${address} (chain ${chainId}): on-chain symbol "${symbol}" not in ASSET_EXPECTED_SYMBOLS[${label}] (${JSON.stringify(expected)})`
        )
        failed = true
      } else {
        console.log(
          `[${done}/${toCheck.length}] OK   ${label} @ ${address.slice(0, 10)}... (chain ${chainId}) => "${symbol}"`
        )
      }
    } catch (e) {
      done++
      console.error(
        `[${done}/${toCheck.length}] FAIL ${label} @ ${address} (chain ${chainId}): ${(e as Error).message}`
      )
      failed = true
    }
  }

  if (failed) {
    console.log("")
    console.error("verify-assets: one or more checks failed. Fix config or roxy and re-run.")
    process.exit(1)
  }

  console.log("")
  console.log("verify-assets: all checks passed. Computing verification hash...")
  const payload = getAssetsVerificationPayload(assets)
  const hash = keccak256(stringToHex(ASSETS_VERIFICATION_SALT + payload))
  console.log("")
  console.log("All assets verified on-chain. Populate this into ASSETS_VERIFIED_HASH on config.ts:")
  console.log("  " + hash)
}

main()
