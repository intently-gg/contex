import { getDefaultConfig } from "@rainbow-me/rainbowkit"
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
} from "wagmi/chains"

// Generic "hyperlink" icon SVG as default (three chain links connected diagonally)
export const DEFAULT_CHAIN_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cellipse cx='7' cy='17' rx='4' ry='4'/%3E%3Cellipse cx='12' cy='12' rx='4' ry='4'/%3E%3Cellipse cx='17' cy='7' rx='4' ry='4'/%3E%3Cpath d='M9.8 14.2L14.2 9.8'/%3E%3C/svg%3E"



async function checkIconExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    try {
      const response = await fetch(url, { method: "GET" })
      return response.ok
    } catch {
      return false
    }
  }
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
  getChainWithIcon(optimism),
  getChainWithIcon(arbitrum),
  getChainWithIcon(polygon),
  getChainWithIcon(zksync),
  getChainWithIcon(base),
  getChainWithIcon(linea),
  getChainWithIcon(mode),
  getChainWithIcon(lisk),
  getChainWithIcon(blast),
  getChainWithIcon(scroll),
  getChainWithIcon(redstone),
  getChainWithIcon(zora),
  getChainWithIcon(worldchain),
  getChainWithIcon(ink),
  getChainWithIcon(soneium),
  getChainWithIcon(unichain),
  getChainWithIcon(bsc),
  getChainWithIcon(lens),
  getChainWithIcon(avalanche),
  getChainWithIcon(sonic),
  getChainWithIcon(hyperliquid),
  getChainWithIcon(plasma),
  getChainWithIcon(monad),
])

export const config = getDefaultConfig({
  appName: "Contex",
  projectId: "0518955ce1537db7cdcb490aab40b722",
  chains: chainsWithIcons,
  ssr: false,
})

