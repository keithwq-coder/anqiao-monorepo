// src/lib/db.ts — MySQL 连接池（mysql2/promise）
// 对外保持原 pg 风格外观：pool.query(text, params) 返回 { rows, rowCount }，
// 适配层完成方言转换：$N 占位符（数组参数自动展开为 (?,?,..) 用于 IN/any）、
// 剥除残留 ::cast、random()→rand()。调用方除 RETURNING/特殊 JSON 谓词外无需改动。
import mysql from "mysql2/promise";

const globalForMysql = globalThis as unknown as { _wikiMysqlPool?: mysql.Pool };

function makePool(): mysql.Pool {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    // 构建期（next build）可能无 DB；仅当实际查询时才需要
  }
  return mysql.createPool({ uri: url, connectionLimit: 10, idleTimeout: 30_000, charset: "utf8mb4" });
}

const globalPool = globalForMysql._wikiMysqlPool ?? makePool();
if (process.env.NODE_ENV !== "production") {
  globalForMysql._wikiMysqlPool = globalPool;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  insertId?: number;
}

/** pg→MySQL 方言转换：$N（数组参数展开）、剥 ::cast、random()→rand()。
 *  若 SQL 不含 $N（调用方已用裸 ?），参数按位置对应。 */
function toMysqlSql(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  let text = sql;
  if (/\$\d+/.test(sql)) {
    text = sql.replace(/\$(\d+)(::[a-zA-Z]+(?:\[\])?)?/g, (_m, nRaw: string) => {
      const p = params[Number(nRaw) - 1];
      if (Array.isArray(p)) {
        if (p.length === 0) return "(null)";
        values.push(...p);
        return "(" + p.map(() => "?").join(",") + ")";
      }
      values.push(p === undefined ? null : p);
      return "?";
    });
  } else {
    values.push(...params);
  }
  text = text.replace(/::[a-zA-Z]+(\[\])?/g, "").replace(/\brandom\(\)/gi, "rand()");
  return { text, values };
}

/** 值内联：Turbopack 打包后 mysql2 的客户端占位符替换会失效（? 原样下发致 1064），
 *  故适配层自行转义内联；约束：SQL 文本中的 ? 仅允许出现在占位符位置。 */
function fmt(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return "'" + v.toISOString().slice(0, 19).replace("T", " ") + "'";
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

export const pool = {
  async query<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const { text, values } = toMysqlSql(sql, params);
    let i = 0;
    const finalSql = text.replace(/\?/g, () => fmt(values[i++]));
    const [res] = await globalPool.query(finalSql);
    if (Array.isArray(res)) {
      return { rows: res as unknown as T[], rowCount: res.length };
    }
    const hdr = res as mysql.ResultSetHeader;
    return { rows: [], rowCount: hdr.affectedRows ?? 0, insertId: hdr.insertId };
  },
};
