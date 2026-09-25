#!/bin/bash
# Run Alembic migration on server

cd /tmp/anqiao-crm-migrations

# Setup Python environment
source /home/ubuntu/venv-anqiao-crm/bin/activate || {
    python3 -m venv /home/ubuntu/venv-anqiao-crm
    source /home/ubuntu/venv-anqiao-crm/bin/activate
    pip install alembic sqlalchemy psycopg[binary] --quiet
}

# Copy files to correct location
mkdir -p /opt/anqiao-crm/releases/current
cp -r /tmp/anqiao-crm-src/* /opt/anqiao-crm/releases/current/src/
cp /tmp/alembic.ini /opt/anqiao-crm/releases/current/

# Set up environment variables
export DATABASE_URL="postgresql://anqiao_crm_app:__REDACTED_RUNTIME_SECRET__@localhost/anqiao_crm"

echo "=== Running Alembic Migration ==="
cd /opt/anqiao-crm/releases/current
python -m alembic upgrade head

echo "=== Migration Complete ==="
