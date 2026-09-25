#!/bin/bash
# Debug script to test settings loading

set -x

cd /opt/anqiao-crm

# Load environment variables
source /opt/anqiao-crm/shared/database.env

echo "=== Environment Variables ==="
echo "DATABASE_HOST: ${DATABASE_HOST:-NOT_SET}"
echo "DATABASE_NAME: ${DATABASE_NAME:-NOT_SET}"
echo "DATABASE_USER: ${DATABASE_USER:-NOT_SET}"
echo "DATABASE_PASSWORD: ${DATABASE_PASSWORD:+SET (hidden)}"
echo ""

export DATABASE_HOST=${DATABASE_HOST:-localhost}
export DATABASE_NAME=anqiao_crm
export DATABASE_USER=anqiao_crm_app
export PYTHONPATH=/opt/anqiao-crm/src:$PYTHONPATH

echo "=== Testing Python Import ==="
/opt/anqiao-crm/venv/bin/python /tmp/test_settings.py
