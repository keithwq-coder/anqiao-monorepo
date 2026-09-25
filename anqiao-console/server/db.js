// 阶段四 · sqlite 数据层（INTEGRATION-SPEC §8 阶段四）
// 映射内存模型：租户告警/处置、账号口令哈希、长护险状态、可变体征快照。
// DATA_LAYER=sqlite 启用；缺省 seed 为种子内存态（可回滚）。
// 注意：node:sqlite 仅 Node ≥22 可用；seed 模式不加载该内置模块（兼容 Node 20）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function dataLayerMode() {
  const mode = (process.env.DATA_LAYER || 'seed').toLowerCase()
  return mode === 'sqlite' ? 'sqlite' : 'seed'
}

export function dbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH
  return path.join(__dirname, 'anqiao.sqlite')
}

let db = null
let sqliteReady = null

async function ensureDb() {
  if (db) return db
  if (!sqliteReady) {
    sqliteReady = (async () => {
      let DatabaseSync
      try {
        ;({ DatabaseSync } = await import('node:sqlite'))
      } catch (err) {
        throw new Error(
          `DATA_LAYER=sqlite 需要 Node ≥22 内置 node:sqlite（当前 node=${process.version}）: ${err.message}`,
        )
      }
      const file = dbPath()
      const dir = path.dirname(file)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      db = new DatabaseSync(file)
      db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_alerts (
          tenant_id TEXT NOT NULL PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS accounts (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ltc_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tenant_vitals (
          tenant_id TEXT NOT NULL,
          patient_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (tenant_id, patient_id)
        );
      `)
      db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')").run()
      return db
    })()
  }
  return sqliteReady
}

export function closeDb() {
  if (db) {
    try {
      db.close()
    } catch {
      /* ignore */
    }
    db = null
    sqliteReady = null
  }
}

function now() {
  return new Date().toISOString()
}

export async function saveTenantAlerts(tenantId, alerts) {
  if (dataLayerMode() !== 'sqlite') return false
  const conn = await ensureDb()
  conn
    .prepare(
      `INSERT INTO tenant_alerts (tenant_id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
    .run(tenantId, JSON.stringify(alerts), now())
  return true
}

export async function loadAllTenantAlerts() {
  if (dataLayerMode() !== 'sqlite') return {}
  try {
    const conn = await ensureDb()
    const rows = conn.prepare('SELECT tenant_id, payload FROM tenant_alerts').all()
    const out = {}
    for (const r of rows) {
      try {
        out[r.tenant_id] = JSON.parse(r.payload)
      } catch {
        /* skip */
      }
    }
    return out
  } catch (err) {
    console.error('[db] loadAllTenantAlerts failed, falling back to seed:', err.message)
    return {}
  }
}

export async function saveAccountHash(username, passwordHash) {
  if (dataLayerMode() !== 'sqlite') return false
  const conn = await ensureDb()
  conn
    .prepare(
      `INSERT INTO accounts (username, password_hash, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
    )
    .run(username, passwordHash, now())
  return true
}

export async function loadAccountHashes() {
  if (dataLayerMode() !== 'sqlite') return {}
  try {
    const conn = await ensureDb()
    const rows = conn.prepare('SELECT username, password_hash FROM accounts').all()
    const out = {}
    for (const r of rows) out[r.username] = r.password_hash
    return out
  } catch (err) {
    console.error('[db] loadAccountHashes failed:', err.message)
    return {}
  }
}

export async function saveLtcState(state) {
  if (dataLayerMode() !== 'sqlite') return false
  const conn = await ensureDb()
  conn
    .prepare(
      `INSERT INTO ltc_state (id, payload, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
    .run(JSON.stringify(state), now())
  return true
}

export async function loadLtcState() {
  if (dataLayerMode() !== 'sqlite') return null
  try {
    const conn = await ensureDb()
    const row = conn.prepare('SELECT payload FROM ltc_state WHERE id = 1').get()
    if (!row) return null
    return JSON.parse(row.payload)
  } catch (err) {
    console.error('[db] loadLtcState failed:', err.message)
    return null
  }
}

export async function saveTenantVitalsSnapshot(tenantId, patients) {
  if (dataLayerMode() !== 'sqlite') return false
  const conn = await ensureDb()
  const stmt = conn.prepare(
    `INSERT INTO tenant_vitals (tenant_id, patient_id, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, patient_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
  const ts = now()
  try {
    conn.exec('BEGIN')
    for (const p of patients) {
      stmt.run(tenantId, p.patient_id, JSON.stringify(p.vitals), ts)
    }
    conn.exec('COMMIT')
    return true
  } catch (err) {
    try {
      conn.exec('ROLLBACK')
    } catch {
      /* ignore */
    }
    console.error('[db] vitals snapshot failed:', err.message)
    return false
  }
}

export async function loadTenantVitals(tenantId) {
  if (dataLayerMode() !== 'sqlite') return {}
  try {
    const conn = await ensureDb()
    const rows = conn.prepare('SELECT patient_id, payload FROM tenant_vitals WHERE tenant_id = ?').all(tenantId)
    const out = {}
    for (const r of rows) {
      try {
        out[r.patient_id] = JSON.parse(r.payload)
      } catch {
        /* skip */
      }
    }
    return out
  } catch {
    return {}
  }
}
