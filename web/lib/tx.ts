import { NETWORK, VAULT_ID } from "@/lib/contracts";
import { toStroops } from "@/lib/format";
import { loadKit } from "@/lib/wallet-kit";

const RPC_URL =
  NETWORK === "mainnet" ? "https://mainnet.sorobanrpc.com" : "https://soroban-testnet.stellar.org";

/**
 * Contract error codes, mapped to sentences.
 *
 * These come straight from the `VaultError` enum in `contracts/vault/src/error.rs` and must stay in
 * step with it. A user should never see `Error(Contract, #20)`: the contract already knows exactly
 * what went wrong, and passing that through as a number throws the information away at the last
 * step.
 */
const VAULT_ERRORS: Record<number, string> = {
  3: "That action needs the admin or keeper role.",
  10: "Enter an amount greater than zero.",
  11: "That is too small to buy a single share. Try a slightly larger amount.",
  12: "The first deposit into the vault has to be a little larger than that.",
  13: "That many shares are worth less than one stroop. Try redeeming more.",
  20: "Deposits are paused right now. Withdrawals are unaffected.",
  21: "The vault is at its deposit cap for the beta. Try a smaller amount.",
  30: "Not enough is liquid right now to cover that. Try a smaller amount.",
  33: "That strategy is for a different asset.",
  51: "A strategy reported more than it delivered, so the transaction was rejected.",
};

export type TxPhase = "idle" | "simulating" | "signing" | "submitting" | "confirming" | "done";

export class TxError extends Error {
  constructor(
    message: string,
    /** True when the user declined in their wallet, which is not a failure worth apologising for. */
    readonly declined = false,
  ) {
    super(message);
    this.name = "TxError";
  }
}

/** Turns whatever the SDK or wallet threw into something worth showing a person. */
function humanize(cause: unknown): TxError {
  const raw = cause instanceof Error ? cause.message : String(cause);

  // Soroban surfaces contract failures as `Error(Contract, #N)`.
  const code = raw.match(/Error\(Contract,\s*#(\d+)\)/)?.[1];
  if (code && VAULT_ERRORS[Number(code)]) {
    return new TxError(VAULT_ERRORS[Number(code)]!);
  }

  if (/reject|denied|declined|cancel/i.test(raw)) {
    return new TxError("You cancelled the transaction.", true);
  }
  if (/insufficient balance|underfunded|op_underfunded/i.test(raw)) {
    return new TxError("Your wallet does not have enough XLM for this, including the fee.");
  }
  if (/account not found|op_no_source_account/i.test(raw)) {
    return new TxError("That account is not funded yet. Get free testnet XLM from the faucet.");
  }
  if (/timeout|timed out/i.test(raw)) {
    return new TxError("The network did not confirm in time. Check your wallet before retrying.");
  }
  if (/trustline|op_no_trust/i.test(raw)) {
    return new TxError("Your wallet needs a trustline for this asset first.");
  }
  return new TxError(raw || "Something went wrong. Nothing was submitted.");
}

/**
 * Build, simulate, sign, submit, and wait for one vault call.
 *
 * Simulation happens **before** the wallet is asked for anything. A deposit into a paused vault or
 * one over its cap fails deterministically, and finding that out during simulation means the user
 * gets a clear sentence instead of a wallet prompt for a transaction that was always going to
 * revert.
 *
 * The SDK is imported here rather than at module scope so it stays out of the initial bundle: it
 * is large, and nobody browsing the site should download it until they actually transact.
 */
async function invokeVault({
  address,
  method,
  amount,
  onPhase,
}: {
  address: string;
  method: "deposit" | "redeem";
  /** Human amount in XLM or nXLM; converted to stroops here. */
  amount: number;
  onPhase?: (phase: TxPhase) => void;
}): Promise<string> {
  // Through the shared loader so the kit is guaranteed initialised, even if the user hits deposit
  // before the session-restore effect has finished.
  const [
    { Address, BASE_FEE, Contract, Networks, TransactionBuilder, nativeToScVal, rpc },
    kit,
  ] = await Promise.all([import("@stellar/stellar-sdk"), loadKit()]);

  const passphrase = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  const server = new rpc.Server(RPC_URL);
  const stroops = toStroops(amount);

  onPhase?.("simulating");

  let prepared;
  try {
    const account = await server.getAccount(address);
    const args = [
      new Address(address).toScVal(),
      nativeToScVal(stroops, { type: "i128" }),
    ];

    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(new Contract(VAULT_ID).call(method, ...args))
      .setTimeout(120)
      .build();

    // `prepareTransaction` simulates and folds the resulting auth entries and resource footprint
    // back into the transaction. It throws on a contract revert, which is exactly what we want.
    prepared = await server.prepareTransaction(tx);
  } catch (cause) {
    throw humanize(cause);
  }

  onPhase?.("signing");

  let signedXdr: string;
  try {
    const result = await kit.signTransaction(prepared.toXDR(), {
      networkPassphrase: passphrase,
      address,
    });
    signedXdr = result.signedTxXdr;
  } catch (cause) {
    throw humanize(cause);
  }

  onPhase?.("submitting");

  let hash: string;
  try {
    const signed = TransactionBuilder.fromXDR(signedXdr, passphrase);
    const sent = await server.sendTransaction(signed);

    if (sent.status === "ERROR") {
      throw new Error(JSON.stringify(sent.errorResult ?? sent));
    }
    hash = sent.hash;
  } catch (cause) {
    throw humanize(cause);
  }

  onPhase?.("confirming");

  // Poll rather than fire and forget. Telling someone a deposit succeeded before the ledger closed
  // means they refresh, see the old balance, and stop trusting the interface.
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const result = await server.getTransaction(hash);
      if (result.status === "SUCCESS") {
        onPhase?.("done");
        return hash;
      }
      if (result.status === "FAILED") {
        throw new Error(JSON.stringify(result.resultXdr ?? "transaction failed"));
      }
    } catch (cause) {
      if (cause instanceof Error && /FAILED|Contract/.test(cause.message)) throw humanize(cause);
      // NOT_FOUND simply means the ledger has not closed yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  throw new TxError("Submitted, but the network has not confirmed yet. Check your wallet.");
}

export function deposit(args: {
  address: string;
  amount: number;
  onPhase?: (phase: TxPhase) => void;
}) {
  return invokeVault({ ...args, method: "deposit" });
}

export function redeem(args: {
  address: string;
  amount: number;
  onPhase?: (phase: TxPhase) => void;
}) {
  return invokeVault({ ...args, method: "redeem" });
}
