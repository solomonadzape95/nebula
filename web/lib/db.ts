import pg from "pg";

// numeric(40,0) exceeds Number.MAX_SAFE_INTEGER, so pg must hand it back as a string rather than
// silently rounding it into a float. Stroop amounts are money; a rounded balance is a wrong one.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => value);

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  pool ??= new pg.Pool({
    connectionString: url,
    max: 4,
    // A page render should not hang on a database that is not answering.
    connectionTimeoutMillis: 4_000,
    idleTimeoutMillis: 20_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

/**
 * One query, or null.
 *
 * Null rather than a throw is deliberate and load-bearing: the indexer's database is allowed to be
 * unreachable, and that should grey out a chart rather than 500 a page. Callers distinguish "no
 * rows" (`[]`) from "could not ask" (`null`).
 *
 * `quiet` suppresses the log for failures that are expected rather than exceptional, like a unique
 * violation when a username is already taken.
 */
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  options: { quiet?: boolean } = {},
): Promise<T[] | null> {
  const db = getPool();
  if (!db) return null;
  try {
    const { rows } = await db.query<T>(sql, params);
    return rows;
  } catch (error) {
    if (!options.quiet) {
      console.error("[db] query failed:", (error as Error).message);
    }
    return null;
  }
}
