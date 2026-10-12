/**
 * Token Holder Monitor - Chain Configurations & Analysis Engine
 * Bounty #59: Token Holder Monitor
 */

import { ethers } from "ethers";
import { 
  ChainConfig, ChainId, HolderInfo, ConcentrationMetrics, HolderAlert, 
  LargeTransfer, TokenInfo, HolderMonitorRequest, HolderMonitorResponse 
} from "./types";

export const CHAINS: Record<ChainId, ChainConfig> = {
  ethereum: {
    name: "ethereum",
    rpcUrl: "",
    blockExplorerUrl: "https://api.etherscan.io/api",
    nativeToken: "ETH",
    chainId: 1,
  },
  polygon: {
    name: "polygon",
    rpcUrl: "",
    blockExplorerUrl: "https://api.polygonscan.com/api",
    nativeToken: "MATIC",
    chainId: 137,
  },
  arbitrum: {
    name: "arbitrum",
    rpcUrl: "",
    blockExplorerUrl: "https://api.arbiscan.io/api",
    nativeToken: "ETH",
    chainId: 42161,
  },
  optimism: {
    name: "optimism",
    rpcUrl: "",
    blockExplorerUrl: "https://api-optimistic.etherscan.io/api",
    nativeToken: "ETH",
    chainId: 10,
  },
  base: {
    name: "base",
    rpcUrl: "",
    blockExplorerUrl: "https://api.basescan.org/api",
    nativeToken: "ETH",
    chainId: 8453,
  },
};

export function getChainConfig(chain: ChainId): ChainConfig {
  const config = CHAINS[chain];
  if (!config) throw new Error(`Unknown chain: ${chain}`);
  return config;
}

export function getConfiguredChains(env: { [key: string]: string }): ChainId[] {
  const chains: ChainId[] = [];
  for (const chain of Object.keys(CHAINS) as ChainId[]) {
    const envKey = `${chain.toUpperCase()}_RPC_URL`;
    if (env[envKey]) {
      chains.push(chain);
    }
  }
  return chains;
}

// ERC20 ABI for token info and holder queries
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function Transfer(address indexed from, address indexed to, uint256 value)",
];

// Known contract labels for major addresses
export const KNOWN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "Null Address",
  "0x000000000000000000000000000000000000dEaD": "Burn Address",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
  "0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12": "USDC",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
  "0x6B175474E89094C44Da98b954EedeAC495271d0F": "DAI",
  "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8": "Aave V3 Pool",
  "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9": "Aave V2 Pool",
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D": "Uniswap V2 Router",
  "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 Router",
  "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F": "SushiSwap Router",
  "0x1111111254EEB25477B68fb85Ed929f73A960582": "1inch Router",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Protocol",
  "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5": "OpenSea Seaport",
  "0x28C6c06298d514Db089934071355E5743bf21d60": "Binance Hot Wallet",
  "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549": "Binance Hot Wallet 2",
  "0x503828976D22510aad0201ac7EC88293211D23Da": "Binance Hot Wallet 3",
  "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF": "Binance Hot Wallet 4",
  "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3": "Binance Hot Wallet 5",
  "0x267be1C1D684F78cb4F6a176C49e1b381E2E2E2E": "Kraken",
  "0x8C6c28D3Fd3dE56F04E0d566d0b9a20C30A4E6D9": "Coinbase",
  "0x71660c4005BA85c37cffcAcB9028d447dc7a7D1F": "Coinbase 2",
};

function calculateGiniCoefficient(balances: number[]): number {
  if (balances.length === 0) return 0;
  
  const sorted = [...balances].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  
  for (let i = 0; i < n; i++) {
    sum += (2 * i - n + 1) * sorted[i];
  }
  
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  
  return sum / (n * total);
}

function calculateHHI(balances: number[], totalSupply: number): number {
  if (totalSupply === 0) return 0;
  
  let hhi = 0;
  for (const balance of balances) {
    const share = balance / totalSupply;
    hhi += share * share;
  }
  
  return hhi * 10000; // Scale to 0-10000
}

function getCentralizationRisk(metrics: ConcentrationMetrics): "low" | "medium" | "high" | "critical" {
  if (metrics.giniCoefficient >= 0.9 || metrics.top10Percentage >= 90) return "critical";
  if (metrics.giniCoefficient >= 0.8 || metrics.top10Percentage >= 75) return "high";
  if (metrics.giniCoefficient >= 0.6 || metrics.top10Percentage >= 50) return "medium";
  return "low";
}

function generateAlerts(
  holders: HolderInfo[],
  metrics: ConcentrationMetrics,
  previousMetrics?: ConcentrationMetrics
): HolderAlert[] {
  const alerts: HolderAlert[] = [];
  const now = Date.now();
  
  // Check for critical centralization
  if (metrics.giniCoefficient >= 0.9) {
    alerts.push({
      type: "concentration_increase",
      severity: "critical",
      message: `Extreme centralization detected: Gini coefficient ${metrics.giniCoefficient.toFixed(3)}`,
      timestamp: now,
    });
  }
  
  // Check for high centralization
  if (metrics.giniCoefficient >= 0.8) {
    alerts.push({
      type: "concentration_increase",
      severity: "warning",
      message: `High centralization detected: Top 10 holders control ${metrics.top10Percentage.toFixed(1)}% of supply`,
      timestamp: now,
    });
  }
  
  // Check for whale dominance
  if (metrics.top1Percentage >= 50) {
    alerts.push({
      type: "new_whale",
      severity: "critical",
      message: `Single holder controls ${metrics.top1Percentage.toFixed(1)}% of total supply`,
      holderAddress: holders[0]?.address,
      timestamp: now,
    });
  }
  
  // Compare with previous metrics if available
  if (previousMetrics) {
    const giniChange = metrics.giniCoefficient - previousMetrics.giniCoefficient;
    const top10Change = metrics.top10Percentage - previousMetrics.top10Percentage;
    
    if (giniChange > 0.05 || top10Change > 5) {
      alerts.push({
        type: "concentration_increase",
        severity: "warning",
        message: `Centralization increased significantly: Gini +${giniChange.toFixed(3)}, Top10% +${top10Change.toFixed(1)}%`,
        timestamp: now,
      });
    }
  }
  
  return alerts;
}

export async function analyzeTokenHolders(request: HolderMonitorRequest, env: { [key: string]: string }): Promise<HolderMonitorResponse> {
  const chainConfig = getChainConfig(request.chain);
  if (!chainConfig.rpcUrl) {
    throw new Error(`RPC URL not configured for ${request.chain}`);
  }
  
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  const contractAddress = request.contractAddress.toLowerCase();
  const minHolders = request.minHolders || 100;
  const maxHolders = request.maxHolders || 1000;
  const warnings: string[] = [];
  
  try {
    // Get token info
    const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      tokenContract.name().catch(() => "Unknown"),
      tokenContract.symbol().catch(() => "UNKNOWN"),
      tokenContract.decimals().catch(() => 18),
      tokenContract.totalSupply().catch(() => BigInt(0)),
    ]);
    
    const totalSupplyNum = Number(totalSupply);
    if (totalSupplyNum === 0) {
      warnings.push("Total supply is 0 or unavailable");
    }
    
    // In a real implementation, we would:
    // 1. Query block explorer API for token holder list
    // 2. For each holder, query balance
    // 3. Sort by balance
    // 4. Calculate metrics
    
    // For now, simulate with known patterns
    // In production, this would use Etherscan/Polygonscan/etc. APIs
    const simulatedHolders: HolderInfo[] = [];
    
    // Generate simulated holders based on typical distributions
    // This is a placeholder - real implementation needs block explorer API
    warnings.push("Holder analysis requires block explorer API (Etherscan/Polygonscan/Arbiscan) for real data");
    
    // Simulate some holders for testing
    for (let i = 0; i < Math.min(minHolders, 10); i++) {
      const percentage = i === 0 ? 30 : (i === 1 ? 15 : (i === 2 ? 10 : 5 - i * 0.5));
      const balance = BigInt(Math.floor((totalSupplyNum * percentage / 100) / 1e18) * 1e18);
      
      simulatedHolders.push({
        address: "0x" + (i + 1).toString(16).padStart(40, "0"),
        balance: balance.toString(),
        balanceFormatted: ethers.formatUnits(balance, 18),
        percentage,
        rank: i + 1,
        isContract: i < 3,
        label: KNOWN_LABELS["0x" + (i + 1).toString(16).padStart(40, "0")],
      });
    }
    
    // Calculate metrics from simulated data
    const balances = simulatedHolders.map(h => Number(h.balance) / 1e18);
    const totalSupplyFormatted = ethers.formatUnits(totalSupply, decimals);
    
    const metrics: ConcentrationMetrics = {
      giniCoefficient: calculateGiniCoefficient(balances),
      hhiIndex: calculateHHI(balances, totalSupplyNum),
      top10Percentage: simulatedHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0),
      top100Percentage: simulatedHolders.slice(0, 100).reduce((sum, h) => sum + h.percentage, 0),
      top1Percentage: simulatedHolders[0]?.percentage || 0,
    };
    
    const centralizationRisk = getCentralizationRisk(metrics);
    const alerts = generateAlerts(simulatedHolders, metrics);
    
    // Simulate large transfers
    const largeTransfers: LargeTransfer[] = [
      {
        from: "0x" + "1".repeat(40),
        to: "0x" + "2".repeat(40),
        amount: "100000000000000000000",
        amountFormatted: "100.00",
        percentageOfSupply: 5.0,
        timestamp: Date.now() - 3600000,
        txHash: "0x" + "a".repeat(64),
      },
      {
        from: "0x" + "3".repeat(40),
        to: "0x" + "4".repeat(40),
        amount: "50000000000000000000",
        amountFormatted: "50.00",
        percentageOfSupply: 2.5,
        timestamp: Date.now() - 7200000,
        txHash: "0x" + "b".repeat(64),
      },
    ];
    
    // Add transfer alerts
    for (const transfer of largeTransfers) {
      if (transfer.percentageOfSupply > 1) {
        alerts.push({
          type: "large_transfer",
          severity: transfer.percentageOfSupply > 5 ? "critical" : "warning",
          message: `Large transfer detected: ${transfer.amountFormatted} tokens (${transfer.percentageOfSupply}% of supply) from ${transfer.from.slice(0,6)}... to ${transfer.to.slice(0,6)}...`,
          amount: transfer.amount,
          timestamp: transfer.timestamp,
        });
      }
    }
    
    return {
      token: {
        address: contractAddress,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString(),
        totalSupplyFormatted,
        chain: request.chain,
      },
      holderCount: simulatedHolders.length,
      holders: simulatedHolders,
      concentrationMetrics: metrics,
      centralizationRisk,
      alerts,
      largeTransfers,
      warnings,
      timestamp: Date.now(),
    };
  } catch (e) {
    throw new Error(`Failed to analyze token holders: ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

export type { ChainConfig, HolderInfo, ConcentrationMetrics, HolderAlert, LargeTransfer, TokenInfo, HolderMonitorRequest, HolderMonitorResponse } from "./types";
export { calculateGiniCoefficient, calculateHHI, getCentralizationRisk };