import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { MIGRATIONS_DIR } from "./config.js";

// numeric(40,0) exceeds Number.MAX_SAFE_INTEGER, so pg must hand it back as a string rather than
// silently rounding it into a float. Stroop amounts are money; a rounded balance is a wrong one.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => value);

export type Db = pg.Pool;

export function connect(databaseUrl: string): Db {
  return new pg.Pool({
    connectionString: databaseUrl,
    // Hosted Postgres (Neon, Supabase) requires TLS; a local container does not offer it.
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  });
}

export async function migrate(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rowCount } = await db.query("SELECT 1 FROM migrations WHERE name = $1", [file]);
    if (rowCount) continue;

    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
