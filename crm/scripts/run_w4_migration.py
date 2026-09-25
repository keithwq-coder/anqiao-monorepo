"""Run W4 migration with fresh venv."""
import subprocess
import sys

def run_cmd(name, cmd):
    """Run command and return result."""
    print(f"=== {name} ===")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        print(f"Return code: {result.returncode}")
        if result.stdout:
            print(f"Output:\n{result.stdout}")
        if result.stderr:
            print(f"Error:\n{result.stderr}")
        return result.returncode == 0, result
    except Exception as e:
        print(f"ERROR: {e}")
        return False, None

def main():
    # Step 2a: Create anqiao_crm schema first (connect to postgres database)
    print("\n=== W4 Step 2a: Create anqiao_crm schema ===")
    create_schema_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d postgres -c \"CREATE SCHEMA IF NOT EXISTS anqiao_crm;\""
    ]
    
    success, _ = run_cmd("Create schema", create_schema_cmd)
    if not success:
        print("ERROR: Failed to create schema - aborting")
        return False
    
    # Step 2b: Grant permissions to anqiao_crm_app (connect to postgres)
    print("\n=== W4 Step 2b: Grant schema permissions ===")
    grant_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d postgres -c \"GRANT ALL ON SCHEMA anqiao_crm TO anqiao_crm_app;\""
    ]
    
    success, _ = run_cmd("Grant permissions", grant_cmd)
    if not success:
        print("ERROR: Failed to grant permissions - aborting")
        return False
    
    # Step 2c: Create fresh venv in /opt/anqiao-crm
    print("\n=== W4 Step 2c: Create fresh virtual environment ===")
    venv_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "cd /opt/anqiao-crm && rm -rf venv && python3 -m venv venv"
    ]
    success, result = run_cmd("Create venv", venv_cmd)
    if not success:
        print("ERROR: Failed to create venv - aborting")
        return False
    
    # Step 2d: Install dependencies using venv
    print("\n=== W4 Step 2d: Install dependencies in venv ===")
    pip_install = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "/opt/anqiao-crm/venv/bin/pip install --upgrade pip && "
        "/opt/anqiao-crm/venv/bin/pip install alembic psycopg2-binary pydantic pydantic-settings sqlalchemy fastapi uvicorn psycopg[binary]"
    ]
    success, result = run_cmd("Install in venv", pip_install)
    if not success:
        return False
    
    # Step 2e: Run alembic upgrade head using correct PYTHONPATH
    print("\n=== W4 Step 2e: Run alembic upgrade head ===")
    # crm is in src/crm, so PYTHONPATH must include /opt/anqiao-crm/src
    simple_alembic = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "cd /opt/anqiao-crm && PYTHONPATH=/opt/anqiao-crm/src:$PYTHONPATH DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm DATABASE_USER=anqiao_crm_app DATABASE_PASSWORD=\"$DATABASE_PASSWORD\" ALEMBIC_CONFIG=alembic.ini ./venv/bin/python -m alembic upgrade head"
    ]
    
    success, result = run_cmd("Alembic migration", simple_alembic)
    if not success:
        print("ERROR: Migration failed - would attempt downgrade")
        return False
    
    print("\nOK - Alembic migration completed successfully")
    
    # Verify tables created
    print("\n=== Verification: List created tables ===")
    verify_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d anqiao_crm -c \"\\dt anqiao_crm.*\""
    ]
    run_cmd("Verify tables", verify_cmd)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
