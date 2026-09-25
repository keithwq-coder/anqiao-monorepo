"""Check database user status and fix password."""
import subprocess

def main():
    # Check if user exists
    cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        "sudo -u postgres psql -c \"SELECT usename FROM pg_user WHERE usename='anqiao_crm_app';\""
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    print("Current users:")
    print(result.stdout)
    if result.stderr:
        print(f"Error:\n{result.stderr}")
    
    # Fix password if exists
    print("\nSetting password for anqiao_crm_app...")
    alter_cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes",
        "ubuntu@124.222.212.159",
        'sudo -u postgres psql -c "ALTER USER anqiao_crm_app PASSWORD \'"$DB_PASSWORD"\';"  # DB_PASSWORD from runtime env; never hardcode'
    ]
    
    result = subprocess.run(alter_cmd, capture_output=True, text=True, timeout=60)
    print("Result:")
    print(result.stdout)
    if result.stderr:
        print(f"Error:\n{result.stderr}")

if __name__ == "__main__":
    main()
