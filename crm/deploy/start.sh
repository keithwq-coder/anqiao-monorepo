#!/bin/bash
set -eo pipefail

cd /opt/anqiao-crm

# 加载数据库环境变量
if [[ ! -f /opt/anqiao-crm/shared/database.env ]]; then
    echo "ERROR: /opt/anqiao-crm/shared/database.env not found"
    exit 1
fi

# Source and explicitly export all variables from database.env
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$value"
done < /opt/anqiao-crm/shared/database.env

# Load AI integration environment (glm-5.2 / AI_SHANGJI gateway) when present.
# Fail-closed: if the file is absent, no AI vars are exported and the app keeps
# its default fallback behavior (ai_enabled=False). The API key lives only in
# this server-side file, never in the repo, logs, or audit records.
if [[ -f /opt/anqiao-crm/shared/ai.env ]]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        case "$key" in
            # TASK-0042 / DEC-0164: canonical names are CRM_AI_REASON_*.
            # AI_SHANGJI_* is kept here so a pre-rename ai.env file still
            # exports its values during the rollout window.
            CRM_AI_REASON_*|AI_SHANGJI_*|AI_ENABLED)
                export "$key=$value" ;;
        esac
    done < /opt/anqiao-crm/shared/ai.env
fi

# 设置其他必需的环境变量
export DATABASE_HOST=localhost
export DATABASE_NAME=anqiao_crm
export DATABASE_USER=anqiao_crm_app
export PYTHONPATH=/opt/anqiao-crm/src:$PYTHONPATH
export SESSION_COOKIE_SECURE=true

# 验证必需变量
: "${DATABASE_PASSWORD:?DATABASE_PASSWORD not set}"
: "${SESSION_SECRET_KEY:?SESSION_SECRET_KEY not set}"

# 启动应用
exec /opt/anqiao-crm/venv/bin/uvicorn \
    crm.web.main:app \
    --host 0.0.0.0 \
    --port 8200 \
    --log-level info
