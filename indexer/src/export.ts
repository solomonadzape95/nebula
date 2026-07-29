import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { STROOPS, type Config } from "./config.js";
import type { Db } from "./db.js";
import {
  depositors,
  harvestRows,
  realizedApy,
  sharePriceSeries,
  stats,
  strategyFlows,
  userActions,
} from "./queries.js";

/**
 * CSV export of the testnet record.
 *
 * The submission asks for traction as a spreadsheet, and a spreadsheet is exactly the format in
 * which numbers are easiest to make up. So the design goal here is not "produce a CSV" — it is
 * "produce a CSV that a reviewer can disprove". Three properties do that work:
 *
 *   1. Every row that represents activity carries its own transaction hash and an explorer URL.
 *      Nothing has to be taken on trust at the level of the row, which means nothing has to be
 *      taken on trust at the level of the total either.
 *   2. Nothing is filtered. Withdrawals are exported alongside deposits, and `days_active` is
 *      carried per address, so a batch of wallets scripted in one sitting is visible as one. A
 *      file that hid that would be worth less, not more: a reviewer who finds one thing hidden
 *      stops believing the rest.
 *   3. Totals are recomputed from the same rows, in the same run, so the summary and the detail
 *      cannot drift apart between exports.
 *
 * What it cannot prove is the part no on-chain record can: that the human behind an address is a
 * different human. That gap is what the survey in `docs/USER_SURVEY.md` exists to close, by
 * collecting an address alongside a person and letting the two be joined.
 */

/** One whole unit, unformatted — no thousands separators, because this is going into a cell. */
function plain(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const frac = (abs % STROOPS).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${abs / STROOPS}.${frac}`;
}

function iso(at: Date | null): string {
  return at ? at.toISOString() : "";
}

/**
 * RFC 4180 quoting.
 *
 * Applied to every field rather than only the ones that look like they need it. A free-text column
 * added later would otherwise be a silent corruption waiting for its first comma.
 */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
}

export interface ExportResult {
  directory: string;
  files: { name: string; rows: number }[];
}

/**
 * Write the whole record to `directory` as CSV. Returns what was written, for the caller to print.
 *
 * Overwrites rather than appends. The database is the record and this is a rendering of it, so a
 * stale row surviving a re-export would make the file disagree with the chain — the one thing it
 * must never do.
 */
export async function exportCsv(
  db: Db,
  config: Config,
  directory: string,
): Promise<ExportResult> {
  const explorer = (hash: string) =>
    `https://stellar.expert/explorer/${config.network}/tx/${hash}`;

  const [summary, wallets, actions, harvests, series, flows, apy] = await Promise.all([
    stats(db),
    depositors(db),
    userActions(db),
    harvestRows(db),
    sharePriceSeries(db, 10_000),
    strategyFlows(db),
    realizedApy(db),
  ]);

  // Depositors who came back on a later day. The headline count answers "how many wallets"; this
  // answers "how many of them behaved like someone with a reason to return", which is the question
  // a reviewer is actually asking when they look at the headline count.
  const returning = wallets.filter((w) => w.daysActive > 1).length;

  const files: { name: string; body: string }[] = [
    {
      name: "summary.csv",
      body: csv(
        ["metric", "value", "unit"],
        [
          ["network", config.network, ""],
          ["vault_contract", config.deployment.vault, ""],
          ["share_token_contract", config.deployment.shareToken, ""],
          ["exported_at_utc", new Date().toISOString(), ""],
          ["unique_depositors", wallets.length, "wallets"],
          ["depositors_active_on_more_than_one_day", returning, "wallets"],
          ["deposits", summary.depositCount, "transactions"],
          ["withdrawals", summary.withdrawCount, "transactions"],
          ["total_deposited", plain(summary.totalDeposited), "XLM"],
          ["total_withdrawn", plain(summary.totalWithdrawn), "XLM"],
          ["tvl", plain(summary.totalAssets), "XLM"],
          ["share_price", plain(summary.sharePrice), "XLM per nXLM"],
          ["harvests", summary.harvestCount, "transactions"],
          ["gross_yield_realized", plain(summary.grossYield), "XLM"],
          ["protocol_fees_taken", plain(summary.feesTaken), "XLM"],
          ["realized_apy", apy ? apy.percent.toFixed(4) : "", "percent"],
          ["realized_apy_window", apy ? apy.windowHours.toFixed(2) : "", "hours"],
          ["first_activity_utc", iso(summary.firstActivity), ""],
          ["last_activity_utc", iso(summary.lastActivity), ""],
        ],
      ),
    },
    {
      name: "depositors.csv",
      body: csv(
        [
          "rank",
          "account",
          "deposits",
          "withdrawals",
          "total_deposited_xlm",
          "days_active",
          "first_seen_utc",
          "last_seen_utc",
          "first_tx_hash",
          "explorer_url",
        ],
        wallets.map((w, i) => [
          i + 1,
          w.account,
          w.deposits,
          w.withdrawals,
          plain(w.totalDeposited),
          w.daysActive,
          iso(w.firstSeen),
          iso(w.lastSeen),
          w.firstTxHash,
          explorer(w.firstTxHash),
        ]),
      ),
    },
    {
      name: "transactions.csv",
      body: csv(
        [
          "timestamp_utc",
          "ledger",
          "account",
          "action",
          "amount_xlm",
          "shares_nxlm",
          "tx_hash",
          "explorer_url",
        ],
        actions.map((a) => [
          iso(a.at),
          a.ledger,
          a.account,
          a.action,
          plain(a.assets),
          plain(a.shares),
          a.txHash,
          explorer(a.txHash),
        ]),
      ),
    },
    {
      name: "harvests.csv",
      body: csv(
        ["timestamp_utc", "gross_xlm", "fee_xlm", "net_xlm", "tx_hash", "explorer_url"],
        harvests.map((h) => [
          iso(h.at),
          plain(h.gross),
          plain(h.fee),
          plain(h.net),
          h.txHash,
          explorer(h.txHash),
        ]),
      ),
    },
    {
      name: "share-price.csv",
      body: csv(
        ["timestamp_utc", "share_price_xlm_per_nxlm", "tvl_xlm"],
        series.map((p) => [iso(p.at), plain(p.sharePrice), plain(p.totalAssets)]),
      ),
    },
    {
      name: "strategy-flows.csv",
      body: csv(
        ["strategy", "allocated_xlm", "unwound_xlm", "net_deployed_xlm"],
        flows.map((f) => [f.strategy, plain(f.allocated), plain(f.unwound), plain(f.net)]),
      ),
    },
  ];

  mkdirSync(directory, { recursive: true });
  for (const file of files) {
    writeFileSync(resolve(directory, file.name), file.body, "utf8");
  }

  return {
    directory,
    // Counted from the written bytes rather than from the arrays, so the number reported is the
    // number of lines actually in the file.
    files: files.map(({ name, body }) => ({ name, rows: body.trimEnd().split("\n").length - 1 })),
  };
}
