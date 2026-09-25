// src/lib/db.ts — PostgreSQL 连接池（原生 pg，无 ORM）
import { Pool } from "pg";

const globalForPg = globalThis as unknown as { _wikiPgPool?: Pool };

function makePool(): Pool {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    // 构建期（next build）可能无 DB；仅当实际查询时才需要
  }
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalForPg._wikiPgPool ?? makePool();

if (process.env.NODE_ENV !== "production") {
  globalForPg._wikiPgPool = pool;
}
