#!/bin/bash
# PostgreSQL privilege setup for anqiao_crm_app user

echo "=== Setting up database privileges ==="

# Set password for anqiao_crm_app user
sudo -u postgres psql <<'EOSQL'
ALTER USER anqiao_crm_app WITH PASSWORD '__REDACTED_RUNTIME_SECRET__';
EOSQL

# Grant database privileges
sudo -u postgres psql <<'EOSQL'
GRANT ALL PRIVILEGES ON DATABASE anqiao_crm TO anqiao_crm_app;
EOSQL

echo "=== Privileges granted successfully ==="
