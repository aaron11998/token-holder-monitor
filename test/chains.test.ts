import { describe, it, expect } from "vitest";
import { CHAINS, getChainConfig, getConfiguredChains, KNOWN_LABELS, calculateGiniCoefficient, calculateHHI, getCentralizationRisk } from "../src/chains";
import { ChainId } from "../src/types";

describe("Chains Configuration", () => {
  it("should have all 5 chains configured", () => {
    expect(Object.keys(CHAINS).length).toBe(5);
    expect(CHAINS.ethereum).toBeDefined();
    expect(CHAINS.polygon).toBeDefined();
    expect(CHAINS.arbitrum).toBeDefined();
    expect(CHAINS.optimism).toBeDefined();
    expect(CHAINS.base).toBeDefined();
  });

  it("should have required properties for each chain", () => {
    const chains: ChainId[] = ["ethereum", "polygon", "arbitrum", "optimism", "base"];
    for (const chain of chains) {
      const config = CHAINS[chain];
      expect(config.name).toBe(chain);
      expect(config.blockExplorerUrl).toBeDefined();
      expect(config.nativeToken).toBeDefined();
      expect(config.chainId).toBeGreaterThan(0);
    }
  });

  it("should have correct chain IDs", () => {
    expect(CHAINS.ethereum.chainId).toBe(1);
    expect(CHAINS.polygon.chainId).toBe(137);
    expect(CHAINS.arbitrum.chainId).toBe(42161);
    expect(CHAINS.optimism.chainId).toBe(10);
    expect(CHAINS.base.chainId).toBe(8453);
  });
});

describe("Chain Helpers", () => {
  it("getChainConfig should return correct config", () => {
    const eth = getChainConfig("ethereum");
    expect(eth.name).toBe("ethereum");
    expect(eth.chainId).toBe(1);
    expect(eth.nativeToken).toBe("ETH");
  });

  it("getChainConfig should throw for unknown chain", () => {
    expect(() => getChainConfig("unknown" as ChainId)).toThrow();
  });

  it("getConfiguredChains should filter by env vars", () => {
    const env = {
      ETHEREUM_RPC_URL: "https://eth.example.com",
      POLYGON_RPC_URL: "https://polygon.example.com",
    };
    const configured = getConfiguredChains(env);
    expect(configured).toContain("ethereum");
    expect(configured).toContain("polygon");
    expect(configured).not.toContain("arbitrum");
  });

  it("getConfiguredChains should return empty for no config", () => {
    const configured = getConfiguredChains({});
    expect(configured.length).toBe(0);
  });
});

describe("Known Labels", () => {
  it("should have known labels for major contracts", () => {
    expect(KNOWN_LABELS["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]).toBe("WETH");
    expect(KNOWN_LABELS["0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12"]).toBe("USDC");
    expect(KNOWN_LABELS["0xdAC17F958D2ee523a2206206994597C13D831ec7"]).toBe("USDT");
    expect(KNOWN_LABELS["0x6B175474E89094C44Da98b954EedeAC495271d0F"]).toBe("DAI");
  });

  it("should have exchange labels", () => {
    expect(KNOWN_LABELS["0x28C6c06298d514Db089934071355E5743bf21d60"]).toBe("Binance Hot Wallet");
    expect(KNOWN_LABELS["0x8C6c28D3Fd3dE56F04E0d566d0b9a20C30A4E6D9"]).toBe("Coinbase");
    expect(KNOWN_LABELS["0x71660c4005BA85c37cffcAcB9028d447dc7a7D1F"]).toBe("Coinbase 2");
  });
});

describe("Concentration Metrics", () => {
  it("calculateGiniCoefficient should return 0 for empty array", () => {
    expect(calculateGiniCoefficient([])).toBe(0);
  });

  it("calculateGiniCoefficient should return 0 for perfect equality", () => {
    expect(calculateGiniCoefficient([10, 10, 10, 10])).toBe(0);
  });

  it("calculateGiniCoefficient should return high for inequality", () => {
      const gini = calculateGiniCoefficient([10000, 1, 1, 1]);
      expect(gini).toBeGreaterThan(0.7);
      expect(gini).toBeLessThanOrEqual(1);
    });

  it("calculateGiniCoefficient should return 1 for single holder", () => {
    expect(calculateGiniCoefficient([100])).toBe(0); // Single holder = no inequality possible in this formula
  });
});

describe("HHI Index", () => {
  it("calculateHHI should return 0 for zero supply", () => {
    expect(calculateHHI([10, 10, 10], 0)).toBe(0);
  });

  it("calculateHHI should return 10000 for single holder", () => {
    expect(calculateHHI([100], 100)).toBe(10000);
  });

  it("calculateHHI should return 2500 for 4 equal holders", () => {
    expect(calculateHHI([25, 25, 25, 25], 100)).toBe(2500);
  });

  it("calculateHHI should be high for concentrated distribution", () => {
    const hhi = calculateHHI([90, 5, 3, 2], 100);
    expect(hhi).toBeGreaterThan(8000);
  });
});

describe("Centralization Risk", () => {
  it("getCentralizationRisk should return critical for extreme centralization", () => {
    const metrics = { giniCoefficient: 0.95, top10Percentage: 95, top100Percentage: 100, top1Percentage: 80, hhiIndex: 9000 };
    expect(getCentralizationRisk(metrics)).toBe("critical");
  });

  it("getCentralizationRisk should return high for high centralization", () => {
    const metrics = { giniCoefficient: 0.85, top10Percentage: 80, top100Percentage: 95, top1Percentage: 40, hhiIndex: 7000 };
    expect(getCentralizationRisk(metrics)).toBe("high");
  });

  it("getCentralizationRisk should return medium for moderate centralization", () => {
    const metrics = { giniCoefficient: 0.65, top10Percentage: 60, top100Percentage: 90, top1Percentage: 25, hhiIndex: 4000 };
    expect(getCentralizationRisk(metrics)).toBe("medium");
  });

  it("getCentralizationRisk should return low for decentralized", () => {
    const metrics = { giniCoefficient: 0.3, top10Percentage: 30, top100Percentage: 60, top1Percentage: 10, hhiIndex: 1000 };
    expect(getCentralizationRisk(metrics)).toBe("low");
  });
});