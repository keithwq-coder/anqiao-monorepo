"""Check anqiao_crm database schema emptiness on remote server."""
import subprocess
import sys

def main():
    # SSH command to check table count (read-only) - using simpler query
    cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -d anqiao_crm -c \"SELECT count(*) FROM pg_tables WHERE schemaname = 'anqiao_crm';\""
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        print("=== Step 1: Read-only verification of anqiao_crm schema ===")
        print(f"Return code: {result.returncode}")
        print(f"Output:\n{result.stdout}")
        if result.stderr:
            print(f"Error:\n{result.stderr}")
        
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if line.strip() and not line.strip().startswith('count') and not line.strip().startswith('-'):
                    count = int(line.strip())
                    print(f"\nSTATUS: anqiao_crm schema has {count} tables")
                    if count == 0:
                        print("OK - Schema is EMPTY (zero business tables)")
                        print("   Ready to proceed with migration")
                        return True
                    else:
                        print(f"WARNING: Schema has {count} tables - verify this is expected")
                        return False
        
        print("ERROR - Could not parse output")
        return False
            
    except subprocess.TimeoutExpired:
        print("ERROR - SSH connection timed out")
    except Exception as e:
        print(f"ERROR - Error executing SSH: {e}")
    return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
