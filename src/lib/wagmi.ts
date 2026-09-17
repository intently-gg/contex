import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "wagmi"
import { RPC_URL_OVERRIDES } from "@/lib/config"
import {
  mainnet,
  optimism,
  arbitrum,
  polygon,
  zksync,
  base,
  linea,
  mode,
  lisk,
  blast,
  scroll,
  redstone,
  zora,
  worldchain,
  ink,
  soneium,
  unichain,
  bsc,
  lens,
  avalanche,
  sonic,
  hyperliquid,
  plasma,
  monad,
  apeChain,
  cronos,
  gnosis,
  fuse,
  celo,
  mantle,
  berachain,
  sei,
  bob,
  fraxtal,
  ronin,
  taiko,
  robinhood,
  megaeth,
  arc
} from "wagmi/chains"

// Generic "hyperlink" icon SVG as default (three chain links connected diagonally)
export const DEFAULT_CHAIN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cellipse cx='7' cy='17' rx='4' ry='4'/%3E%3Cellipse cx='12' cy='12' rx='4' ry='4'/%3E%3Cellipse cx='17' cy='7' rx='4' ry='4'/%3E%3Cpath d='M9.8 14.2L14.2 9.8'/%3E%3C/svg%3E"



async function checkIconExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(url, { 
        method: "HEAD",
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response.ok && response.status !== 403
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === "AbortError") return false
      try {
        const response = await fetch(url, { 
          method: "GET",
          signal: controller.signal,
        })
        return response.ok && response.status !== 403
      } catch {
        return false
      }
    }
  } catch {
    return false
  }
}

async function getChainListApiIcon(chainId: number): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    try {
      const response = await fetch(`https://chainlistapi.com/chains/${chainId}`, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        const data = await response.json()
        if (data.iconUrl && typeof data.iconUrl === 'string') {
          // If chainlistapi returns ethereum.jpg for a non-ethereum chain, treat as not found
          // (it apparently does this sometimes.. even for popular chains like OP.. weird)
          if (data.iconUrl === "https://chainlistapi.com/icons/ethereum.jpg" && chainId !== 1) {
            return null
          }
          const iconExists = await checkIconExists(data.iconUrl)
          return iconExists ? data.iconUrl : null
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name !== "AbortError") {
        // Silently fail
      }
    }
  } catch {
    // Silently fail
  }
  return null
}

async function getChainWithIcon<T extends { id: number }>(chain: T): Promise<T & { iconUrl: string; iconBackground: string }> {
  const chainWithAny = chain as any
  const existingIcon = chainWithAny.iconUrl || (chainWithAny.nativeCurrency as any)?.iconUrl
  
  if (existingIcon) {
    return {
      ...chain,
      iconUrl: existingIcon,
      iconBackground: '#d3d3d3', // Light gray background
    }
  }
  
  // Try chainlistapi.com first
  const chainListIcon = await getChainListApiIcon(chain.id)
  
  if (chainListIcon) {
    return {
      ...chain,
      iconUrl: chainListIcon,
      iconBackground: '#d3d3d3', // Light gray background
    }
  }
  
  // Fallback to Amichain
  const cdnIconUrl = `https://cdn.jsdelivr.net/gh/Amichain/chain-icons/svg/${chain.id}.svg`
  const iconExists = await checkIconExists(cdnIconUrl)
  
  return {
    ...chain,
    iconUrl: iconExists ? cdnIconUrl : DEFAULT_CHAIN_ICON,
    iconBackground: '#d3d3d3', // Light gray background
  }
}

const chainsWithIcons = await Promise.all([
  getChainWithIcon(mainnet),
  getChainWithIcon(base),
  getChainWithIcon(arbitrum),
  getChainWithIcon(polygon),
  getChainWithIcon(robinhood),
  getChainWithIcon(bsc),
  getChainWithIcon(arc),
  getChainWithIcon(hyperliquid),
  getChainWithIcon(optimism),
  getChainWithIcon(unichain),
  getChainWithIcon(linea),
  getChainWithIcon(zora),
  getChainWithIcon(avalanche),
  getChainWithIcon(worldchain),
  getChainWithIcon(ink),
  getChainWithIcon(megaeth),
  getChainWithIcon(soneium),
  getChainWithIcon(zksync),
  getChainWithIcon(monad),
  getChainWithIcon(plasma),
  getChainWithIcon(sonic),
  getChainWithIcon(gnosis),
  getChainWithIcon(celo),
  getChainWithIcon(scroll),
  getChainWithIcon(mode),
  getChainWithIcon(lisk),
  getChainWithIcon(berachain),
  getChainWithIcon(apeChain),
  getChainWithIcon(cronos),
  getChainWithIcon(ronin),
  getChainWithIcon(taiko),
  getChainWithIcon(fuse),
  getChainWithIcon(mantle),
  getChainWithIcon(lens),
  getChainWithIcon(sei),
  getChainWithIcon(bob),
  getChainWithIcon(redstone),
  getChainWithIcon(blast),
  getChainWithIcon(fraxtal),
])

const transports = Object.fromEntries(
  chainsWithIcons.map((chain) => [
    chain.id,
    chain.id in RPC_URL_OVERRIDES ? http(RPC_URL_OVERRIDES[chain.id]!) : http(),
  ])
) as Record<(typeof chainsWithIcons)[number]["id"], ReturnType<typeof http>>

export const config = getDefaultConfig({
  appName: "contex",
  projectId: "0518955ce1537db7cdcb490aab40b722",
  chains: chainsWithIcons,
  transports,
  ssr: false,
})

