import { resolve } from "node:path";

import { loadConfig, REPO_ROOT } from "./config.js";
import { connect, migrate, type Db } from "./db.js";
import { exportCsv } from "./export.js";
import { depositors, fmt, realizedApy, stats, strategyFlows } from "./queries.js";
import { sync } from "./sync.js";

const USAGE = `nebula-indexer <command>

  migrate      create or update the database schema
  sync         ingest new events once, then exit  (use this from cron)
  watch        ingest continuously
  stats        print vault totals, including the depositor count
  depositors   print every address that has deposited, with transaction hashes
  flows        print capital allocated to and unwound from each strategy
  export [dir] write the whole record to CSV  (default: evidence/)
`;

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function runSync(db: Db, config: ReturnType<typeof loadConfig>): Promise<void> {
  const result = await sync(db, config);
  const behind = Math.max(result.latestLedger - result.syncedThrough, 0);
  console.log(
    `  ${result.ingested} new event(s); synced through ledger ${result.syncedThrough} ` +
      `of ${result.latestLedger}` +
      (behind > 0 ? ` (${behind} behind)` : " (caught up)"),
  );
  // Both of these mean the stored history is missing something, so a scheduled run should fail
  // rather than report success on an incomplete data set.
  if (result.skipped > 0) {
    console.warn(`  ! ${result.skipped} event(s) could not be stored`);
    process.exitCode = 1;
  }
  if (result.gapDetected) {
    process.exitCode = 1;
  }
}

async function printStats(db: Db): Promise<void> {
  const s = await stats(db);
  const apy = await realizedApy(db);

  const rows: [string, string][] = [
    ["TVL", `${fmt(s.totalAssets)} XLM`],
    ["Share price", `${fmt(s.sharePrice)} XLM per nXLM`],
    ["Unique depositors", String(s.uniqueDepositors)],
    ["Deposits / withdrawals", `${s.depositCount} / ${s.withdrawCount}`],
    ["Total deposited", `${fmt(s.totalDeposited)} XLM`],
    ["Total withdrawn", `${fmt(s.totalWithdrawn)} XLM`],
    ["Harvests", String(s.harvestCount)],
    ["Gross yield", `${fmt(s.grossYield)} XLM`],
    ["Protocol fees", `${fmt(s.feesTaken)} XLM`],
    [
      "Realized APY",
      apy
        ? `${apy.percent.toFixed(2)}% (over ${apy.windowHours.toFixed(1)}h)`
        : "not enough history yet",
    ],
    ["First activity", s.firstActivity?.toISOString() ?? "—"],
    ["Last activity", s.lastActivity?.toISOString() ?? "—"],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(width)}  ${value}`);
  }
}

async function printDepositors(db: Db, network: string): Promise<void> {
  const rows = await depositors(db);
  if (rows.length === 0) {
    console.log("  no deposits indexed yet");
    return;
  }

  console.log(`  ${rows.length} unique depositor(s)\n`);
  console.log(
    `  ${"#".padEnd(4)}${"account".padEnd(58)}${"deposited".padStart(16)}  first tx`,
  );
  rows.forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padEnd(4)}${r.account.padEnd(58)}${fmt(r.totalDeposited).padStart(16)}  ` +
        `https://stellar.expert/explorer/${network}/tx/${r.firstTxHash}`,
    );
  });
}

async function printFlows(db: Db): Promise<void> {
  const rows = await strategyFlows(db);
  if (rows.length === 0) {
    console.log("  no strategy flows indexed yet");
    return;
  }
  for (const r of rows) {
    console.log(
      `  ${r.strategy}\n` +
        `    allocated ${fmt(r.allocated)}  unwound ${fmt(r.unwound)}  net ${fmt(r.net)} XLM`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    return;
  }

  const config = loadConfig();
  const db = connect(config.databaseUrl);

  try {
    switch (command) {
      case "migrate":
        console.log(`migrating ${config.network}`);
        await migrate(db);
        console.log("  up to date");
        break;

      case "sync":
        console.log(`syncing vault ${config.deployment.vault} on ${config.network}`);
        await migrate(db);
        await runSync(db, config);
        break;

      case "watch":
        console.log(
          `watching vault ${config.deployment.vault} on ${config.network} ` +
            `every ${config.pollSeconds}s — ctrl-c to stop`,
        );
        await migrate(db);
        for (;;) {
          try {
            await runSync(db, config);
          } catch (error) {
            // A transient RPC failure must not kill a long-running watcher.
            console.error(`  ! sync failed: ${(error as Error).message}`);
          }
          await sleep(config.pollSeconds);
        }

      case "stats":
        await printStats(db);
        break;

      case "depositors":
        await printDepositors(db, config.network);
        break;

      case "flows":
        await printFlows(db);
        break;

      case "export": {
        // Argument is a directory rather than a file: the record is six related tables and
        // flattening them into one sheet would either lose the per-transaction detail or repeat
        // every wallet on every row.
        const target = process.argv[3]
          ? resolve(process.cwd(), process.argv[3])
          : resolve(REPO_ROOT, "evidence");
        const result = await exportCsv(db, config, target);
        console.log(`exported to ${result.directory}`);
        const width = Math.max(...result.files.map((f) => f.name.length));
        for (const file of result.files) {
          console.log(`  ${file.name.padEnd(width)}  ${file.rows} row(s)`);
        }
        break;
      }

      default:
        console.error(`unknown command "${command}"\n`);
        console.log(USAGE);
        process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`\n${(error as Error).message}`);
  process.exit(1);
});
