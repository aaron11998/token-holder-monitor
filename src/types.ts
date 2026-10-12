/**
 * Token Holder Monitor - Shared Types
 * Bounty #59: Token Holder Monitor
 */

// Supported chains
export type ChainId = "ethereum" | "polygon" | "arbitrum" | "optimism" | "base";

// Chain configuration
export interface ChainConfig {
  name: ChainId;
  rpcUrl: string;
  blockExplorerUrl: string;
  apiKey?: string;
  nativeToken: string;
  chainId: number;
}

// Holder info
export interface HolderInfo {
  address: string;
  balance: string; // Raw balance (wei)
  balanceFormatted: string; // Human-readable
  percentage: number; // Percentage of total supply
  rank: number; // Rank by balance
  isContract: boolean;
  label?: string; // Known label (e.g., "Uniswap V3 Pool", "Binance Hot Wallet")
}

// Concentration metrics
export interface ConcentrationMetrics {
  giniCoefficient: number; // 0-1 (0 = perfect equality, 1 = perfect inequality)
  hhiIndex: number; // Herfindahl-Hirschman Index
  top10Percentage: number; // Top 10 holders % of supply
  top100Percentage: number; // Top 100 holders % of supply
  top1Percentage: number; // Top 1 holder % of supply
}

// Alert
export interface HolderAlert {
  type: "new_whale" | "whale_transfer" | "concentration_increase" | "large_transfer" | "new_contract_holder";
  severity: "info" | "warning" | "critical";
  message: string;
  holderAddress?: string;
  amount?: string;
  timestamp: number;
}

// Large transfer
export interface LargeTransfer {
  from: string;
  to: string;
  amount: string;
  amountFormatted: string;
  percentageOfSupply: number;
  timestamp: number;
  txHash: string;
}

// Token info
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  totalSupplyFormatted: string;
  chain: ChainId;
}

// Holder monitor request
export interface HolderMonitorRequest {
  contractAddress: string;
  chain: ChainId;
  minHolders?: number; // Minimum holders to analyze (default: 100)
  maxHolders?: number; // Maximum holders to return (default: 1000)
  includeTransfers?: boolean; // Include recent large transfers (default: true)
  transferLookbackHours?: number; // Hours to look back for transfers (default: 24)
}

// Holder monitor response
export interface HolderMonitorResponse {
  token: TokenInfo;
  holderCount: number;
  holders: HolderInfo[];
  concentrationMetrics: ConcentrationMetrics;
  centralizationRisk: "low" | "medium" | "high" | "critical";
  alerts: HolderAlert[];
  largeTransfers: LargeTransfer[];
  warnings: string[];
  timestamp: number;
}

// Health endpoint response
export interface HealthResponse {
  status: "ok" | "degraded";
  chains: Record<ChainId, { configured: boolean; lastBlock?: number }>;
  timestamp: number;
}

// x402 manifest
export interface X402Manifest {
  x402Version: number;
  resource: string;
  description: string;
  accepts: Array<{
    scheme: "exact";
    network: string;
    asset: string;
    payTo: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
  }>;
  free: string[];
}