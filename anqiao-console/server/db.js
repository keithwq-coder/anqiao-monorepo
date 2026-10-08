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

/**
 * 启动列迁移（仓库首个迁移机制，三层权限模型引入）：
 * 旧库缺 granted_perms / revoked_perms 列时补列，幂等。
 * CREATE TABLE IF NOT EXISTS 只对新库生效——已有 sqlite 文件必须走这里，否则 INSERT 抛错。
 */
const SQLITE_SAAS_USERS_NEW_COLUMNS = [
  ['granted_perms', "TEXT NOT NULL DEFAULT '[]'"],
  ['revoked_perms', "TEXT NOT NULL DEFAULT '[]'"],
]

function migrateSqliteColumns(db) {
  const cols = db.prepare('PRAGMA table_info(saas_users)').all()
  const existing = new Set(cols.map((c) => c.name))
  for (const [col, ddl] of SQLITE_SAAS_USERS_NEW_COLUMNS) {
    if (!existing.has(col)) db.exec(`ALTER TABLE saas_users ADD COLUMN ${col} ${ddl}`)
  }
}

/** MySQL 版同构迁移（MySQL 5.7 兼容：INFORMATION_SCHEMA 检测 + ADD COLUMN） */
async function migrateMysqlColumns(pool) {
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saas_users'",
  )
  const existing = new Set(rows.map((r) => r.COLUMN_NAME))
  const ddl = [
    ['granted_perms', "TEXT NOT NULL"],
    ['revoked_perms', "TEXT NOT NULL"],
  ]
  for (const [col, def] of ddl) {
    if (!existing.has(col)) await pool.query(`ALTER TABLE saas_users ADD COLUMN ${col} ${def}`)
  }
}

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
        CREATE TABLE IF NOT EXISTS saas_users (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL DEFAULT '',
          display_name TEXT NOT NULL DEFAULT '',
          unified_role TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT '',
          tenant_id TEXT NOT NULL DEFAULT 'anqiao',
          workspace TEXT NOT NULL DEFAULT '',
          scope TEXT NOT NULL DEFAULT 'org',
          pool_id TEXT,
          is_seed INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_by TEXT NOT NULL DEFAULT 'seed',
          updated_at TEXT NOT NULL,
          granted_perms TEXT NOT NULL DEFAULT '[]',
          revoked_perms TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS public_leads (
          lead_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS perm_groups (
          group_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          codes TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        );
      `)
      db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')").run()
      migrateSqliteColumns(db)
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
          updated_at VARCHAR(40) NOT NULL,
          granted_perms TEXT NOT NULL,
          revoked_perms TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS public_leads (
          lead_id VARCHAR(64) NOT NULL PRIMARY KEY,
          payload MEDIUMTEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS perm_groups (
          group_id VARCHAR(64) NOT NULL PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          name VARCHAR(64) NOT NULL,
          codes MEDIUMTEXT NOT NULL,
          created_by VARCHAR(64) NOT NULL DEFAULT '',
          updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      await mysqlPool.query("INSERT IGNORE INTO meta (`key`, `value`) VALUES ('schema_version', '1')")
      await migrateMysqlColumns(mysqlPool).catch((err) => console.error('[db] mysql 列迁移失败:', err.message))
      return mysqlPool
    })()
  }
  return mysqlReady
}

export async function saveSaaSUser(u) {
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      d.prepare(`INSERT INTO saas_users (username, password_hash, display_name, unified_role, role, tenant_id, workspace, scope, pool_id, is_seed, is_active, created_by, updated_at, granted_perms, revoked_perms)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(username) DO UPDATE SET
          password_hash = CASE WHEN excluded.password_hash = '' THEN saas_users.password_hash ELSE excluded.password_hash END,
          display_name = excluded.display_name, unified_role = excluded.unified_role, role = excluded.role,
          tenant_id = excluded.tenant_id, workspace = excluded.workspace, scope = excluded.scope,
          pool_id = excluded.pool_id, is_active = excluded.is_active, updated_at = excluded.updated_at,
          granted_perms = excluded.granted_perms, revoked_perms = excluded.revoked_perms`)
        .run(u.username, u.password_hash || '', u.display_name || '', u.unified_role || '', u.role || '',
          u.tenant_id || 'anqiao', u.workspace || '', u.scope || 'org', u.pool_id || null,
          u.is_seed ? 1 : 0, u.is_active === false ? 0 : 1, u.created_by || 'seed', now(),
          JSON.stringify(Array.isArray(u.granted_perms) ? u.granted_perms : []),
          JSON.stringify(Array.isArray(u.revoked_perms) ? u.revoked_perms : []))
      return true
    }
    const pool = await ensureMysql()
    await pool.execute(
      `INSERT INTO saas_users (username, password_hash, display_name, unified_role, role, tenant_id, workspace, scope, pool_id, is_seed, is_active, created_by, updated_at, granted_perms, revoked_perms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE password_hash = IF(VALUES(password_hash) = '', password_hash, VALUES(password_hash)),
         display_name = VALUES(display_name), unified_role = VALUES(unified_role), role = VALUES(role),
         tenant_id = VALUES(tenant_id), workspace = VALUES(workspace), scope = VALUES(scope),
         pool_id = VALUES(pool_id), is_active = VALUES(is_active), updated_at = VALUES(updated_at),
         granted_perms = VALUES(granted_perms), revoked_perms = VALUES(revoked_perms)`,
      [u.username, u.password_hash || '', u.display_name || '', u.unified_role || '', u.role || '',
       u.tenant_id || 'anqiao', u.workspace || '', u.scope || 'org', u.pool_id || null,
       u.is_seed ? 1 : 0, u.is_active === false ? 0 : 1, u.created_by || 'seed', now(),
       JSON.stringify(Array.isArray(u.granted_perms) ? u.granted_perms : []),
       JSON.stringify(Array.isArray(u.revoked_perms) ? u.revoked_perms : [])]
    )
    return true
  } catch (err) {
    console.error('[db] mysql saveSaaSUser failed:', err.message)
    return false
  }
}

export async function loadSaaSUsers() {
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      return d.prepare('SELECT * FROM saas_users WHERE is_active = 1 ORDER BY username').all()
    }
    const pool = await ensureMysql()
    const [rows] = await pool.execute('SELECT * FROM saas_users WHERE is_active = 1 ORDER BY username')
    return rows
  } catch (err) {
    console.error('[db] loadSaaSUsers failed:', err.message)
    return []
  }
}

// ---------- 权限组（N28 组 CRUD，租户私有自定义组）----------

export async function savePermGroup(g) {
  try {
    const codes = JSON.stringify(Array.isArray(g.codes) ? g.codes : [])
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      d.prepare(`INSERT INTO perm_groups (group_id, tenant_id, name, codes, created_by, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(group_id) DO UPDATE SET
          name = excluded.name, codes = excluded.codes, updated_at = excluded.updated_at`)
        .run(g.group_id, g.tenant_id, g.name, codes, g.created_by || '', now())
      return true
    }
    const pool = await ensureMysql()
    await pool.execute(
      `INSERT INTO perm_groups (group_id, tenant_id, name, codes, created_by, updated_at)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), codes = VALUES(codes), updated_at = VALUES(updated_at)`,
      [g.group_id, g.tenant_id, g.name, codes, g.created_by || '', now()],
    )
    return true
  } catch (err) {
    console.error('[db] savePermGroup failed:', err.message)
    return false
  }
}

export async function loadPermGroups(tenantId = null) {
  try {
    let rows
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      if (tenantId) {
        rows = d.prepare('SELECT * FROM perm_groups WHERE tenant_id = ? ORDER BY group_id').all(tenantId)
      } else {
        rows = d.prepare('SELECT * FROM perm_groups ORDER BY group_id').all()
      }
    } else {
      const pool = await ensureMysql()
      if (tenantId) {
        ;[rows] = await pool.execute('SELECT * FROM perm_groups WHERE tenant_id = ? ORDER BY group_id', [tenantId])
      } else {
        ;[rows] = await pool.execute('SELECT * FROM perm_groups ORDER BY group_id')
      }
    }
    return rows.map((r) => ({ ...r, codes: safeParseCodes(r.codes) }))
  } catch (err) {
    console.error('[db] loadPermGroups failed:', err.message)
    return []
  }
}

export async function deletePermGroup(groupId, tenantId) {
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      d.prepare('DELETE FROM perm_groups WHERE group_id = ? AND tenant_id = ?').run(groupId, tenantId)
      return true
    }
    const pool = await ensureMysql()
    await pool.execute('DELETE FROM perm_groups WHERE group_id = ? AND tenant_id = ?', [groupId, tenantId])
    return true
  } catch (err) {
    console.error('[db] deletePermGroup failed:', err.message)
    return false
  }
}

function safeParseCodes(raw) {
  if (Array.isArray(raw)) return raw
  try {
    const arr = JSON.parse(String(raw || '[]'))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function deleteSaaSUser(username) {
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      d.prepare('UPDATE saas_users SET is_active = 0, updated_at = ? WHERE username = ?').run(now(), username)
      return true
    }
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

export async function savePublicLead(lead) {
  const payload = JSON.stringify(lead)
  const ts = now()
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      d.prepare(
        `INSERT INTO public_leads (lead_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(lead_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      ).run(lead.lead_id, payload, ts)
      return true
    }
    if (dataLayerMode() === 'mysql') {
      const pool = await ensureMysql()
      await pool.execute(
        `INSERT INTO public_leads (lead_id, payload, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [lead.lead_id, payload, ts],
      )
      return true
    }
    return false
  } catch (err) {
    console.error('[db] savePublicLead failed:', err.message)
    return false
  }
}

export async function loadPublicLeads() {
  try {
    if (dataLayerMode() === 'sqlite') {
      const d = await ensureDb()
      return d.prepare('SELECT payload FROM public_leads ORDER BY updated_at ASC').all().map((r) => JSON.parse(r.payload))
    }
    if (dataLayerMode() === 'mysql') {
      const pool = await ensureMysql()
      const [rows] = await pool.execute('SELECT payload FROM public_leads ORDER BY updated_at ASC')
      return rows.map((r) => JSON.parse(r.payload))
    }
    return []
  } catch (err) {
    console.error('[db] loadPublicLeads failed:', err.message)
    return []
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
