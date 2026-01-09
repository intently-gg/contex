import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { mainnet, sepolia, arbitrum, optimism, polygon, base } from "wagmi/chains"

export const config = getDefaultConfig({
  appName: "Contex",
  projectId: "0518955ce1537db7cdcb490aab40b722",
  chains: [mainnet, sepolia, arbitrum, optimism, polygon, base],
  ssr: false,
})

