#!/usr/bin/env bash
# 阶段五 · SQLite 生产定时备份任务（Linux crontab 调度包装）
# 依据 docs/INTEGRATION-SPEC.md §8.5.2
# 推荐配置在生产机 crontab:
# 0 3 * * * /home/ubuntu/anqiao-saas/server/backup-sqlite.sh >> /home/ubuntu/anqiao-saas/server/backups/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 默认环境变量
export DB_PATH="${DB_PATH:-${SCRIPT_DIR}/anqiao.sqlite}"
export BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"
export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# 确保 Node.js 路径可用
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

echo "=========================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行 SQLite 定时备份任务"
echo "=========================================================="

cd "${PROJECT_DIR}"
node "${SCRIPT_DIR}/backup-sqlite.mjs"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] SQLite 定时备份任务完成"
echo ""
