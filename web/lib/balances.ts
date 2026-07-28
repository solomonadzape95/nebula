import { Horizon } from "@stellar/stellar-sdk";

import { NETWORK } from "@/lib/contracts";

const HORIZON_URL =
  NETWORK === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";

/**
 * Native XLM balance for an account, from Horizon.
 *
 * Horizon rather than Soroban RPC: the native balance lives on the classic ledger entry, and
 * asking Horizon is one request against reconstructing it from the Stellar Asset Contract.
 *
 * Returns null rather than throwing. An unfunded account is a 404, which is not an error worth
 * surfacing: it just means "no balance", and on testnet it means "go press the faucet".
 */
export async function getNativeBalance(address: string): Promise<number | null> {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  } catch {
    return null;
  }
}
