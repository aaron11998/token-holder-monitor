/**
 * Token Holder Monitor - Main Entry Point
 * Bounty #59: Token Holder Monitor
 * Cloudflare Worker with x402 payment gating
 */

import { Hono } from "hono";
import { paymentMiddleware } from "x402-hono";
import { handleHealth } from "./health";
import { handleHolderMonitor, handleX402Manifest } from "./holders_endpoint";

type Bindings = {
  ORG_EVM_PAYTO: string;
  ETHEREUM_RPC_URL: string;
  POLYGON_RPC_URL: string;
  ARBITRUM_RPC_URL: string;
  OPTIMISM_RPC_URL: string;
  BASE_RPC_URL: string;
  ETHERSCAN_API_KEY?: string;
  POLYGONSCAN_API_KEY?: string;
  ARBISCAN_API_KEY?: string;
  OPTIMISTIC_API_KEY?: string;
  BASESCAN_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Free endpoints
app.get("/health", async (c) => {
  const health = await handleHealth(c.env);
  return c.json(health);
});

app.get("/.well-known/x402.json", async (c) => {
  return handleX402Manifest();
});

// Paid endpoint with x402
app.use("/holders", async (c, next) => {
  const mw = paymentMiddleware(c.env.ORG_EVM_PAYTO as `0x${string}`, {
    "/holders": {
      price: "$0.01",
      network: "base",
      config: {
        description: "Token Holder Monitor: Analyze token holder distributions and centralization risks",
      },
    },
  });
  return mw(c, next);
});

app.post("/holders", async (c) => {
  return handleHolderMonitor(c.req.raw, c.env);
});

export default app;