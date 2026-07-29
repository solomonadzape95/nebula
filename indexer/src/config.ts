import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export interface Deployment {
  network: string;
  vault: string;
  shareToken: string;
  underlying: string;
  strategies?: { kind: string; address: string; pool?: string }[];
}

const RPC_URLS: Record<string, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export interface Config {
  network: string;
  rpcUrl: string;
  databaseUrl: string;
  deployment: Deployment;
  /** Ledger to begin from when the database has no cursor yet. */
  startLedger: number | undefined;
  /** Seconds between passes in `watch` mode. */
  pollSeconds: number;
}

export function loadConfig(): Config {
  const network = process.env.NETWORK ?? "testnet";

  // Addresses come from the deployment file the deploy scripts write, so the indexer, the
  // frontend, and the contracts can never disagree about which vault is being talked about.
  const deploymentPath = resolve(repoRoot, "deployments", `${network}.json`);
  let deployment: Deployment;
  try {
    deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as Deployment;
  } catch {
    throw new Error(
      `No deployment found at ${deploymentPath}. Run scripts/deploy.sh for network "${network}".`,
    );
  }

  const startLedger = process.env.START_LEDGER ? Number(process.env.START_LEDGER) : undefined;
  if (startLedger !== undefined && !Number.isFinite(startLedger)) {
    throw new Error(`START_LEDGER must be a number, got "${process.env.START_LEDGER}"`);
  }

  return {
    network,
    rpcUrl: process.env.RPC_URL ?? RPC_URLS[network] ?? required("RPC_URL", undefined),
    databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
    deployment,
    startLedger,
    pollSeconds: Number(process.env.POLL_SECONDS ?? 15),
  };
}

export const MIGRATIONS_DIR = resolve(here, "..", "migrations");

/** Repository root, so the CSV export lands somewhere predictable regardless of the working directory. */
export const REPO_ROOT = repoRoot;

/** Stroops in one whole unit. XLM and nXLM both use 7 decimals. */
export const STROOPS = 10_000_000n;
