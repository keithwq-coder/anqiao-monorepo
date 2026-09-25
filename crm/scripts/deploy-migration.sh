#!/bin/bash
set -e

echo "=== Deploying Anqiao CRM Database Migration ==="
cd /tmp/deploy-anqiao-$(date +%Y%m%d)
mkdir -p . && cd .

echo "1. Copying source files..."
cp -r /tmp/anqiao-crm-src/src/crm .
cp -r /tmp/anqiao-crm-migrations/migrations .
cp /tmp/alembic.ini .

echo "2. Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "3. Installing dependencies..."
pip install -q alembic sqlalchemy psycopg[binary] pydantic pydantic-settings

echo "4. Configuring database connection..."
export DATABASE_URL="postgresql://anqiao_crm_app:__REDACTED_RUNTIME_SECRET__@localhost/anqiao_crm"

echo "5. Running Alembic migration..."
python -m alembic upgrade head

echo "6. Verifying tables created..."
psql $DATABASE_URL -c "\dt" || true

echo "=== Migration Complete ==="
