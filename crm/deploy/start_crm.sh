#!/bin/bash
cd /opt/anqiao-crm
export PYTHONPATH=/tmp:/tmp/anqiao-src:$PYTHONPATH
export DATABASE_HOST=localhost
export DATABASE_NAME=anqiao_crm
export DATABASE_USER=anqiao_crm_app
export DATABASE_PASSWORD=__REDACTED_RUNTIME_SECRET__
/opt/anqiao-crm/venv/bin/python -m uvicorn crm.web.main:app --host 0.0.0.0 --port 8200 &
