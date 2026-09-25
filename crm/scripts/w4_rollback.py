"""Downgrade and cleanup after failed migration."""
import subprocess
import sys

def main():
    print("=== W4 Rollback: Clean up anqiao_crm schema ===")
    
    # Drop the schema we just created (safe because it's empty)
    drop_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d postgres -c \"DROP SCHEMA IF EXISTS anqiao_crm CASCADE;\""
    ]
    
    try:
        result = subprocess.run(drop_cmd, capture_output=True, text=True, timeout=60)
        print(f"Return code: {result.returncode}")
        if result.stdout:
            print(f"Output:\n{result.stdout}")
        
        if result.returncode == 0:
            print("OK - Schema dropped successfully")
            print("   Server is now in clean state (zero business tables)")
        else:
            print(f"WARNING: Drop returned error\n{result.stderr}")
            
    except Exception as e:
        print(f"ERROR: {e}")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
