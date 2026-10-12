/**
 * Token Holder Monitor - x402 Holder Monitor Endpoint
 * Bounty #59: Token Holder Monitor
 */

import { HolderMonitorRequest, HolderMonitorResponse, X402Manifest } from "./types";
import { analyzeTokenHolders } from "./chains";

const X402_NETWORK = "eip155:8453";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ORG_EVM_PAYTO = "0x76EfB727cd3271C7DE22f92437Be212766C9631f";

export async function handleHolderMonitor(request: Request, env: { [key: string]: string }): Promise<Response> {
  try {
    const body: HolderMonitorRequest = await request.json();
    
    // Validate required fields
    if (!body.contractAddress || !body.chain) {
      return new Response(JSON.stringify({ error: "Missing required fields: contractAddress, chain" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.contractAddress)) {
      return new Response(JSON.stringify({ error: "Invalid contract address format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Analyze token holders
    const result = await analyzeTokenHolders(body, env);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleX402Manifest(): Promise<Response> {
  const manifest: X402Manifest = {
    x402Version: 2,
    resource: "/holders",
    description: "Token Holder Monitor: Analyze token holder distributions, whale wallets, and centralization risks",
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        asset: USDC_BASE,
        payTo: ORG_EVM_PAYTO,
        maxAmountRequired: "10000", // $0.01 in USDC base units
        resource: "/holders",
        description: "One /holders API call",
      },
    ],
    free: ["/health", "/.well-known/x402.json"],
  };
  
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}