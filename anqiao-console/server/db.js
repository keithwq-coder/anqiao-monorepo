// 阶段四 · 持久化数据层（INTEGRATION-SPEC §8 阶段四）
// 映射内存模型：租户告警/处置、账号口令哈希、长护险状态、可变体征快照。
// DATA_LAYER=sqlite 启用（需 Node ≥22 内置 node:sqlite）；
// DATA_LAYER=mysql 启用 MySQL 5.7 持久层（anqiao_console 库，Node 20 兼容，凭据走 MYSQL_* 环境变量或 MYSQL_URL）；
// 缺省 seed 为种子内存态（可回滚）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function dataLayerMode() {
  const mode = (process.env.DATA_LAYER || 'seed').toLowerCase()
  if (mode === 'sqlite') return 'sqlite'
  if (mode === 'mysql') return 'mysql'
  return 'seed'
}

function isPersistentMode() {
  const mode = dataLayerMode()
  return mode === 'sqlite' || mode === 'mysql'
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

// ---- MySQL 5.7 持久层（anqiao_console）----

let mysqlPool = null
let mysqlReady = null

function mysqlConfig() {
  if (process.env.MYSQL_URL) return { uri: process.env.MYSQL_URL, connectionLimit: 5 }
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'anqiao_app',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'anqiao_console',
    charset: 'utf8mb4',
    connectionLimit: 5,
  }
}

async function ensureMysql() {
  if (mysqlPool) return mysqlPool
  if (!mysqlReady) {
    mysqlReady = (async () => {
      const mysql = await import('mysql2/promise')
      mysqlPool = mysql.createPool(mysqlConfig())
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS meta (
          \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
          \`value\` TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS tenant_alerts (
          tenant_id VARCHAR(128) NOT NULL PRIMARY KEY,
          payload MEDIUMTEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          username VARCHAR(128) NOT NULL PRIMARY KEY,
          password_hash VARCHAR(255) NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS ltc_state (
          id INT NOT NULL PRIMARY KEY,
          payload MEDIUMTEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS tenant_vitals (
          tenant_id VARCHAR(128) NOT NULL,
          patient_id VARCHAR(128) NOT NULL,
          payload MEDIUMTEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL,
          PRIMARY KEY (tenant_id, patient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS device_registry (
          id INT NOT NULL PRIMARY KEY,
          assets MEDIUMTEXT NOT NULL,
          lifecycle_logs MEDIUMTEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS saas_users (
          username VARCHAR(64) NOT NULL PRIMARY KEY,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(64) NOT NULL DEFAULT '',
          unified_role VARCHAR(32) NOT NULL DEFAULT '',
          role VARCHAR(32) NOT NULL DEFAULT '',
          tenant_id VARCHAR(64) NOT NULL DEFAULT 'anqiao',
          workspace VARCHAR(64) NOT NULL DEFAULT '',
          scope VARCHAR(16) NOT NULL DEFAULT 'org',
          pool_id VARCHAR(64) NULL,
          is_seed TINYINT(1) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_by VARCHAR(64) NOT NULL DEFAULT 'seed',
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query("INSERT IGNORE INTO meta (`key`, `value`) VALUES ('schema_version', '1')")
      return mysqlPool
    })()
  }
  return mysqlReady
}

export async function saveSaaSUser(u) {
  try {
    const pool = await ensureMysql()
    await pool.execute(
      `INSERT INTO saas_users (username, password_hash, display_name, unified_role, role, tenant_id, workspace, scope, pool_id, is_seed, is_active, created_by, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE password_hash = IF(VALUES(password_hash) = '', password_hash, VALUES(password_hash)),
         display_name = VALUES(display_name), unified_role = VALUES(unified_role), role = VALUES(role),
         tenant_id = VALUES(tenant_id), workspace = VALUES(workspace), scope = VALUES(scope),
         pool_id = VALUES(pool_id), is_active = VALUES(is_active), updated_at = VALUES(updated_at)`,
      [u.username, u.password_hash || '', u.display_name || '', u.unified_role || '', u.role || '',
       u.tenant_id || 'anqiao', u.workspace || '', u.scope || 'org', u.pool_id || null,
       u.is_seed ? 1 : 0, u.is_active === false ? 0 : 1, u.created_by || 'seed', now()]
    )
    return true
  } catch (err) {
    console.error('[db] mysql saveSaaSUser failed:', err.message)
    return false
  }
}

export async function loadSaaSUsers() {
  try {
    const pool = await ensureMysql()
    const [rows] = await pool.execute('SELECT * FROM saas_users WHERE is_active = 1 ORDER BY username')
    return rows
  } catch (err) {
    console.error('[db] mysql loadSaaSUsers failed:', err.message)
    return []
  }
}

export async function deleteSaaSUser(username) {
  try {
    const pool = await ensureMysql()
    await pool.execute('UPDATE saas_users SET is_active = 0, updated_at = ? WHERE username = ?', [now(), username])
    return true
  } catch (err) {
    console.error('[db] mysql deleteSaaSUser failed:', err.message)
    return false
  }
}

export async function saveDeviceRegistry(assets, logs) {
  try {
    const pool = await ensureMysql()
    await pool.execute(
      `INSERT INTO device_registry (id, assets, lifecycle_logs, updated_at) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE assets = VALUES(assets), lifecycle_logs = VALUES(lifecycle_logs), updated_at = VALUES(updated_at)`,
      [JSON.stringify(assets), JSON.stringify(logs), now()]
    )
    return true
  } catch (err) {
    console.error('[db] mysql saveDeviceRegistry failed:', err.message)
    return false
  }
}

export async function loadDeviceRegistry() {
  try {
    const pool = await ensureMysql()
    const [rows] = await pool.execute('SELECT assets, lifecycle_logs FROM device_registry WHERE id = 1')
    if (!rows.length) return null
    return { assets: JSON.parse(rows[0].assets), logs: JSON.parse(rows[0].lifecycle_logs) }
  } catch (err) {
    console.error('[db] mysql loadDeviceRegistry failed:', err.message)
    return null
  }
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
  if (mysqlPool) {
    try {
      mysqlPool.end()
    } catch {
      /* ignore */
    }
    mysqlPool = null
    mysqlReady = null
  }
}

function now() {
  return new Date().toISOString()
}

export async function saveTenantAlerts(tenantId, alerts) {
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      await pool.execute(
        `INSERT INTO tenant_alerts (tenant_id, payload, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [tenantId, JSON.stringify(alerts), now()],
      )
      return true
    } catch (err) {
      console.error('[db] mysql saveTenantAlerts failed:', err.message)
      return false
    }
  }
  if (mode !== 'sqlite') return false
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      const [rows] = await pool.execute('SELECT tenant_id, payload FROM tenant_alerts')
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
      console.error('[db] mysql loadAllTenantAlerts failed, falling back to seed:', err.message)
      return {}
    }
  }
  if (mode !== 'sqlite') return {}
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      await pool.execute(
        `INSERT INTO accounts (username, password_hash, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), updated_at = VALUES(updated_at)`,
        [username, passwordHash, now()],
      )
      return true
    } catch (err) {
      console.error('[db] mysql saveAccountHash failed:', err.message)
      return false
    }
  }
  if (mode !== 'sqlite') return false
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      const [rows] = await pool.execute('SELECT username, password_hash FROM accounts')
      const out = {}
      for (const r of rows) out[r.username] = r.password_hash
      return out
    } catch (err) {
      console.error('[db] mysql loadAccountHashes failed:', err.message)
      return {}
    }
  }
  if (mode !== 'sqlite') return {}
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      await pool.execute(
        `INSERT INTO ltc_state (id, payload, updated_at) VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [JSON.stringify(state), now()],
      )
      return true
    } catch (err) {
      console.error('[db] mysql saveLtcState failed:', err.message)
      return false
    }
  }
  if (mode !== 'sqlite') return false
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      const [rows] = await pool.execute('SELECT payload FROM ltc_state WHERE id = 1')
      if (!rows.length) return null
      return JSON.parse(rows[0].payload)
    } catch (err) {
      console.error('[db] mysql loadLtcState failed:', err.message)
      return null
    }
  }
  if (mode !== 'sqlite') return null
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      const conn = await pool.getConnection()
      const ts = now()
      try {
        await conn.beginTransaction()
        for (const p of patients) {
          await conn.execute(
            `INSERT INTO tenant_vitals (tenant_id, patient_id, payload, updated_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
            [tenantId, p.patient_id, JSON.stringify(p.vitals), ts],
          )
        }
        await conn.commit()
        return true
      } catch (err) {
        try {
          await conn.rollback()
        } catch {
          /* ignore */
        }
        console.error('[db] mysql vitals snapshot failed:', err.message)
        return false
      } finally {
        conn.release()
      }
    } catch (err) {
      console.error('[db] mysql vitals snapshot failed:', err.message)
      return false
    }
  }
  if (mode !== 'sqlite') return false
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
  const mode = dataLayerMode()
  if (mode === 'mysql') {
    try {
      const pool = await ensureMysql()
      const [rows] = await pool.execute('SELECT patient_id, payload FROM tenant_vitals WHERE tenant_id = ?', [tenantId])
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
  if (mode !== 'sqlite') return {}
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
