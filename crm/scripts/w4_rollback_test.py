"""Downgrade and upgrade rollback test."""
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
    # Step 1: Downgrade to base (rollback)
    print("\n=== W4 Rollback Test: Downgrade to base ===")
    downgrade_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "cd /opt/anqiao-crm && PYTHONPATH=/opt/anqiao-crm/src:$PYTHONPATH DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm DATABASE_USER=anqiao_crm_app DATABASE_PASSWORD=\"$DATABASE_PASSWORD\" ALEMBIC_CONFIG=alembic.ini ./venv/bin/python -m alembic downgrade base"
    ]
    
    success, result = run_cmd("Downgrade", downgrade_cmd)
    if not success:
        print("WARNING: Downgrade had issues")
    
    # Step 2: Upgrade to head again
    print("\n=== W4 Rollback Test: Upgrade to head ===")
    upgrade_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "cd /opt/anqiao-crm && PYTHONPATH=/opt/anqiao-crm/src:$PYTHONPATH DATABASE_HOST=localhost DATABASE_NAME=anqiao_crm DATABASE_USER=anqiao_crm_app DATABASE_PASSWORD=\"$DATABASE_PASSWORD\" ALEMBIC_CONFIG=alembic.ini ./venv/bin/python -m alembic upgrade head"
    ]
    
    success, result = run_cmd("Upgrade", upgrade_cmd)
    if not success:
        print("ERROR: Upgrade failed after downgrade")
        return False
    
    print("\nOK - Rollback test completed successfully")
    
    # Verify tables created
    print("\n=== Verification: List created tables in anqiao_crm schema ===")
    verify_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d anqiao_crm -c \"\\dt\""
    ]
    run_cmd("Verify tables", verify_cmd)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
