import {
  Account,
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { cache } from "react";

import { SHARE_TOKEN_ID, STRATEGY_ID, VAULT_ID } from "@/lib/contracts";

const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;

/**
 * Any well-formed account works as a simulation source: read-only calls never touch it and the
 * transaction is never submitted or signed. Using the vault's own admin keeps it obviously real.
 */
const READ_ACCOUNT = "GCXYOFNEKSMLS5JRDGOKLTHN6YE26TZGCQ3VN76K66AIHQXNKJPKJOU5";

const server = new rpc.Server(RPC_URL);

/**
 * Call a contract view function by simulating a transaction against it.
 *
 * Soroban has no separate read endpoint: every call is a transaction, and a read is a transaction
 * you simulate but never submit. Nothing here costs a fee or leaves a trace on chain.
 */
async function simulate<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  const tx = new TransactionBuilder(new Account(READ_ACCOUNT, "0"), {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`${method} failed: ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error(`${method} returned nothing`);
  }
  return scValToNative(sim.result.retval) as T;
}

export interface StrategyInfo {
  address: string;
  weight_bps: number;
  cap: bigint;
  paused: boolean;
  deployed: bigint;
}

export interface VaultState {
  totalAssets: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  idle: bigint;
  availableLiquidity: bigint;
  depositsPaused: boolean;
  feeBps: number;
  reserveBps: number;
  depositCap: bigint;
  strategies: StrategyInfo[];
  /** Interest sitting in Blend that has accrued but not yet been harvested. */
  pendingInterest: bigint;
  strategyAssets: bigint;
}

/**
 * Everything the interface needs about the vault, in one round of parallel simulations.
 *
 * `cache` deduplicates within a single render pass, so several components asking for vault state
 * on one page produce one set of RPC calls rather than several.
 */
export const getVaultState = cache(async (): Promise<VaultState | null> => {
  try {
    const [
      totalAssets,
      totalShares,
      sharePrice,
      idle,
      availableLiquidity,
      depositsPaused,
      params,
      strategies,
    ] = await Promise.all([
      simulate<bigint>(VAULT_ID, "total_assets"),
      simulate<bigint>(VAULT_ID, "total_shares"),
      simulate<bigint>(VAULT_ID, "share_price"),
      simulate<bigint>(VAULT_ID, "idle"),
      simulate<bigint>(VAULT_ID, "available_liquidity"),
      simulate<boolean>(VAULT_ID, "deposits_paused"),
      simulate<{ fee_bps: number; reserve_bps: number; deposit_cap: bigint }>(VAULT_ID, "params"),
      simulate<StrategyInfo[]>(VAULT_ID, "strategies"),
    ]);

    // Strategy reads are separate: a strategy that is unreachable should degrade its own two
    // numbers, not take the whole vault panel down with it.
    let pendingInterest = 0n;
    let strategyAssets = 0n;
    try {
      [pendingInterest, strategyAssets] = await Promise.all([
        simulate<bigint>(STRATEGY_ID, "pending_interest"),
        simulate<bigint>(STRATEGY_ID, "total_assets"),
      ]);
    } catch {
      // Leave both at zero rather than failing the page.
    }

    return {
      totalAssets,
      totalShares,
      sharePrice,
      idle,
      availableLiquidity,
      depositsPaused,
      feeBps: params.fee_bps,
      reserveBps: params.reserve_bps,
      depositCap: params.deposit_cap,
      strategies,
      pendingInterest,
      strategyAssets,
    };
  } catch (error) {
    // Never throw at a page. RPC being unreachable should degrade the numbers, not 500 the site.
    console.error("[stellar] vault read failed:", (error as Error).message);
    return null;
  }
});

/** nXLM balance for one address, in stroops. */
export const getShareBalance = cache(async (address: string): Promise<bigint | null> => {
  try {
    return await simulate<bigint>(SHARE_TOKEN_ID, "balance", [new Address(address).toScVal()]);
  } catch (error) {
    console.error("[stellar] balance read failed:", (error as Error).message);
    return null;
  }
});
