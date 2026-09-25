// scripts/migrate.mjs — 顺序执行 migrations/*.sql，schema_migrations 记录版本
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FATAL: DATABASE_URL 未设置");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(
  `create table if not exists schema_migrations (
     version text primary key,
     applied_at timestamptz not null default now()
   )`
);

const files = (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

const { rows } = await client.query("select version from schema_migrations");
const applied = new Set(rows.map((r) => r.version));

let n = 0;
for (const f of files) {
  if (applied.has(f)) continue;
  const sql = await readFile(path.join(dir, f), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("insert into schema_migrations(version) values($1)", [f]);
    await client.query("COMMIT");
    console.log(`applied ${f}`);
    n++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`FAILED ${f}: ${e.message}`);
    process.exit(1);
  }
}
if (n === 0) console.log("no pending migrations");
await client.end();
