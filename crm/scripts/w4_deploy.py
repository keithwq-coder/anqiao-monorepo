"""Deploy complete code package with migrations to remote server for W4."""
import subprocess
import sys
import tarfile
import tempfile
import os

def run_command(cmd, description):
    """执行命令并返回结果"""
    print(f"\n{'='*60}")
    print(description)
    print('='*60)
    
    result = subprocess.run(
        cmd, 
        shell=False,  # Use list form directly
        capture_output=True, 
        text=True,
        timeout=300,
        encoding='utf-8',
        errors='replace'
    )
    
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result.returncode == 0, result

def main():
    """主部署流程"""
    server = "ubuntu@124.222.212.159"
    deploy_dir = "/tmp/anqiao-crm-deploy.tar.gz"
    
    print("\n" + "="*60)
    print("W4 Migration Deployment - Complete Package")
    print("="*60)
    
    # Step 1: Create local tarball
    print("\n[Step 1] Creating tarball...")
    exclude_patterns = [
        '.git', '__pycache__', '*.pyc', '.venv', 'build', 'dist',
        '.pytest_cache', '.qoder', '.claude', 'deploy_source.tar.gz'
    ]
    
    try:
        tar_path = "anqiao-crm-complete.tar.gz"
        with tarfile.open(tar_path, 'w:gz') as tar:
            for item in os.listdir('.'):
                if item != 'deploy_source.tar.gz':
                    arcname = item
                    skip = False
                    for pattern in exclude_patterns:
                        if pattern.startswith('*.') and item.endswith(pattern[1:]):
                            skip = True
                            break
                        elif item == pattern or item.startswith(pattern):
                            skip = True
                            break
                    if not skip and os.path.exists(item):
                        tar.add(item, arcname=arcname)
        
        print(f"Created tarball: {tar_path}")
        file_size = os.path.getsize(tar_path) / 1024 / 1024
        print(f"Size: {file_size:.2f} MB")
        
    except Exception as e:
        print(f"ERROR: Failed to create tarball: {e}")
        return False
    
    # Step 2: Upload tarball (using scp directly)
    print("\n[Step 2] Uploading tarball to server...")
    upload_result = subprocess.run([
        'scp', '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
        tar_path, f'{server}:{deploy_dir}'
    ], capture_output=True, text=True, timeout=300, encoding='utf-8', errors='replace')
    
    if upload_result.returncode == 0:
        print("Upload successful!")
    else:
        print(f"Upload failed: {upload_result.stderr}")
        return False
    
    # Step 3: Deploy on server
    print("\n[Step 3] Extracting tarball on server...")
    deploy_result = subprocess.run([
        'ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', server,
        'cd /opt/anqiao-crm && mkdir -p backup && mv * backup/ 2>/dev/null; '
        f'tar xzf {deploy_dir}; rm -f {deploy_dir}; echo DONE'
    ], capture_output=True, text=True, timeout=180, encoding='utf-8', errors='replace')
    
    print(deploy_result.stdout)
    if deploy_result.returncode == 0:
        print("Deployment completed!")
    else:
        print(f"Deploy failed: {deploy_result.stderr}")
        return False
    
    # Cleanup
    try:
        os.unlink(tar_path)
        print(f"\nCleaned up local tarball")
    except:
        pass
    
    print("\n" + "="*60)
    print("DEPLOYMENT COMPLETE!")
    print("="*60)
    print("\nNext step: python scripts/run_w4_migration.py")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
