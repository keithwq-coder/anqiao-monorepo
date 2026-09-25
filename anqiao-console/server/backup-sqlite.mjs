// 阶段五 · SQLite 生产持久化自动快照冷备脚本（Node ESM）
// 依据 docs/INTEGRATION-SPEC.md §8.5.2
// 功能：
// 1. 原子快照备份：利用 SQLite 内置 VACUUM INTO 生成紧凑、一致且不影响运行中服务的一致性快照
// 2. 完整性校验：自动执行 PRAGMA integrity_check 校验备份文件
// 3. Gzip 压缩：将快照压缩为 .sqlite.gz，节省磁盘空间
// 4. 自动滚动轮转：默认保留最近 14 天备份，超期自动清理
// 运行：node server/backup-sqlite.mjs [--retention 14]

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'anqiao.sqlite')
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14)

function formatNow() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function runBackup() {
  console.log(`[backup] === SQLite 数据库自动快照备份任务启动 ===`)
  console.log(`[backup] 数据库源文件: ${DB_FILE}`)
  console.log(`[backup] 备份存放目录: ${BACKUP_DIR}`)
  console.log(`[backup] 备份保留天数: ${RETENTION_DAYS} 天`)

  if (!fs.existsSync(DB_FILE)) {
    console.warn(`[backup] 警告: 数据库源文件不存在 (${DB_FILE})，跳过本次备份。`)
    return
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  let DatabaseSync
  try {
    ;({ DatabaseSync } = await import('node:sqlite'))
  } catch (err) {
    throw new Error(`node:sqlite 模块加载失败，请确保使用 Node >= 22: ${err.message}`)
  }

  const timestamp = formatNow()
  const rawBackupFile = path.join(BACKUP_DIR, `anqiao_${timestamp}.sqlite`)
  const gzBackupFile = `${rawBackupFile}.gz`

  console.log(`[backup] 1. 连接源库并执行 VACUUM INTO 快照...`)
  const srcDb = new DatabaseSync(DB_FILE, { readOnly: true })
  try {
    // 触发 WAL 检查点并执行原子导出
    srcDb.exec(`PRAGMA wal_checkpoint(PASSIVE);`)
    // SQLite 路径需规范化斜杠
    const safeBackupPath = rawBackupFile.replace(/\\/g, '/')
    srcDb.exec(`VACUUM INTO '${safeBackupPath}';`)
  } finally {
    srcDb.close()
  }

  console.log(`[backup] 2. 校验快照完整性 (PRAGMA integrity_check)...`)
  const backupDb = new DatabaseSync(rawBackupFile, { readOnly: true })
  try {
    const checkResult = backupDb.prepare('PRAGMA integrity_check').all()
    const isOk = checkResult.length === 1 && checkResult[0].integrity_check === 'ok'
    if (!isOk) {
      throw new Error(`备份完整性校验失败: ${JSON.stringify(checkResult)}`)
    }
    console.log(`[backup]    完整性校验通过: ok`)
  } finally {
    backupDb.close()
  }

  console.log(`[backup] 3. 执行 gzip 压缩...`)
  const sourceStream = fs.createReadStream(rawBackupFile)
  const destStream = fs.createWriteStream(gzBackupFile)
  const gzipStream = zlib.createGzip({ level: 9 })
  await pipeline(sourceStream, gzipStream, destStream)

  // 删除未压缩的临时 sqlite 快照文件
  fs.unlinkSync(rawBackupFile)

  const origStat = fs.statSync(DB_FILE)
  const gzStat = fs.statSync(gzBackupFile)
  const ratio = ((1 - gzStat.size / origStat.size) * 100).toFixed(1)
  console.log(`[backup]    快照压缩完成: ${path.basename(gzBackupFile)}`)
  console.log(`[backup]    原始体积: ${(origStat.size / 1024).toFixed(1)} KB -> 备份体积: ${(gzStat.size / 1024).toFixed(1)} KB (压缩率: ${ratio}%)`)

  console.log(`[backup] 4. 执行旧备份滚动清理 (保留 ${RETENTION_DAYS} 天)...`)
  const nowMs = Date.now()
  const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000
  const allFiles = fs.readdirSync(BACKUP_DIR)
  let removedCount = 0

  for (const file of allFiles) {
    if (file.startsWith('anqiao_') && file.endsWith('.sqlite.gz')) {
      const filePath = path.join(BACKUP_DIR, file)
      const stat = fs.statSync(filePath)
      if (nowMs - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath)
        console.log(`[backup]    清理过期快照: ${file}`)
        removedCount++
      }
    }
  }

  if (removedCount === 0) {
    console.log(`[backup]    无过期快照需要清理。`)
  }

  console.log(`[backup] === SQLite 数据库备份完成 ===\n`)
}

runBackup().catch((err) => {
  console.error(`[backup] 备份异常失败:`, err)
  process.exit(1)
})
