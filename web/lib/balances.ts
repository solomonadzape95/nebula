import { NETWORK, SHARE_TOKEN_ID } from "@/lib/contracts";
import { fromStroops } from "@/lib/format";

const HORIZON_URL =
  NETWORK === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org";

const RPC_URL =
  NETWORK === "mainnet" ? "https://mainnet.sorobanrpc.com" : "https://soroban-testnet.stellar.org";

/**
 * Balances for the connected wallet, read from the browser.
 *
 * Separate from `lib/stellar.ts`, which is server-side and wrapped in React `cache`. These are
 * per-wallet and can only be known after connection, so they cannot be part of a server render.
 * The SDK is imported lazily inside each call to keep it out of the initial bundle.
 *
 * Both return null rather than throwing. An unfunded account is a 404 from Horizon, which is not
 * an error worth surfacing: it means "no balance", and on testnet it means "press the faucet".
 */

export async function getNativeBalance(address: string): Promise<number | null> {
  try {
    const { Horizon } = await import("@stellar/stellar-sdk");
    const account = await new Horizon.Server(HORIZON_URL).loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  } catch {
    return null;
  }
}

/** nXLM balance, as a display number. */
export async function getShareBalance(address: string): Promise<number | null> {
  try {
    const { Account, Address, Contract, Networks, TransactionBuilder, rpc, scValToNative } =
      await import("@stellar/stellar-sdk");

    const passphrase = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
    const server = new rpc.Server(RPC_URL);

    // Read-only simulation, so the source account is never touched and the sequence is irrelevant.
    const tx = new TransactionBuilder(new Account(address, "0"), {
      fee: "100",
      networkPassphrase: passphrase,
    })
      .addOperation(
        new Contract(SHARE_TOKEN_ID).call("balance", new Address(address).toScVal()),
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) return null;

    return fromStroops(scValToNative(sim.result.retval) as bigint);
  } catch {
    return null;
  }
}
