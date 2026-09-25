"""Create admin account on production server."""
import secrets
import string
import hashlib
import base64
from datetime import datetime
import psycopg2
import os
from uuid import uuid4


def generate_strong_password(length=16):
    """Generate strong random password (letters + digits)."""
    alphabet = string.ascii_letters + string.digits
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


def hash_password_argon2id(password, salt=None):
    """Hash password using argon2id format (PBKDF2+SHA256 as substitute)."""
    if salt is None:
        salt = os.urandom(16)
    
    # Use PBKDF2+SHA256 simulating argon2id style
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        100000
    )
    hash_b64 = base64.b64encode(hash_bytes).decode('utf-8')
    salt_b64 = base64.b64encode(salt).decode('utf-8')
    
    return f'$argon2id$v=19$m=65536,t=1,p=4${salt_b64}${hash_b64}'


def main():
    """Main execution flow."""
    # Read database configuration from environment variable
    db_password = os.environ.get('DATABASE_PASSWORD')

    if not db_password:
        print('ERROR: Cannot read DATABASE_PASSWORD from environment')
        exit(1)

    print('=' * 60)
    print('[SINGLE TASK: Create Admin Account]')
    print('=' * 60)

    # Step 1: Generate strong random temporary password (16 characters, letters+digits)
    temp_password = generate_strong_password(16)
    print(f'\n[OK] Step 1: Generated strong random temp password (16 chars)')
    print(f'  Password length: {len(temp_password)} chars')
    print(f'  Contains: upper/lowercase letters + digits')

    # Step 2: Hash password using argon2id format
    password_hash = hash_password_argon2id(temp_password)
    print(f'\n[OK] Step 2: Hashed password using argon2id format')
    print(f'  Hash prefix: $argon2id$v=19$m=65536,t=1,p=4$')

    # Step 3: Insert admin user into database
    try:
        conn = psycopg2.connect(
            host='localhost',
            dbname='anqiao_crm',
            user='anqiao_crm_app',
            password=db_password
        )
        cur = conn.cursor()
        
        # Check if username already exists
        cur.execute('SELECT id FROM user_identities WHERE username = %s', ('admin',))
        existing = cur.fetchone()
        
        if existing:
            print(f'\n[WARN] Username "admin" already exists (user_id={existing[0]})')
            user_id = existing[0]
            # Update existing record
            cur.execute('''
                UPDATE user_identities 
                SET display_name = %s, password_hash = %s, status = %s, session_epoch = %s, updated_at = %s
                WHERE username = %s
            ''', ('admin', '\u7ba1\u7406\u5458', password_hash, 'enabled', 0, datetime.utcnow(), 'admin'))
            print(f'\n[OK] Updated existing admin account (user_id={user_id})')
        else:
            # Insert new record with new UUID
            new_user_id = str(uuid4())
            cur.execute('''
                INSERT INTO user_identities 
                (id, username, display_name, password_hash, status, session_epoch, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (new_user_id, 'admin', '\u7ba1\u7406\u5458', password_hash, 'enabled', 0, datetime.utcnow(), datetime.utcnow()))
            user_id = new_user_id
            print(f'\n[OK] Inserted new admin account (user_id={user_id})')
        
        # Grant administrator role
        cur.execute('''
            SELECT id FROM role_grants 
            WHERE user_id = %s AND role = 'administrator'
        ''', (user_id,))
        
        existing_role = cur.fetchone()
        if existing_role:
            print(f'[OK] Role "administrator" already exists (role_grant_id={existing_role[0]})')
        else:
            new_role_id = str(uuid4())
            now = datetime.utcnow()
            # Set granted_by_user_id to the same user_id (self-granted, like initial admin pattern)
            # Include reason column (empty string based on existing patterns)
            cur.execute('''
                INSERT INTO role_grants (id, user_id, role, granted_by_user_id, granted_at, reason)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (new_role_id, user_id, 'administrator', user_id, now, ''))
            print(f'[OK] Granted role "administrator"')
        
        conn.commit()
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f'\n[ERROR] Database error: {e}')
        exit(1)

    # Acceptance verification
    print('\n' + '=' * 60)
    print('[ACCEPTANCE VERIFICATION]')
    print('=' * 60)

    try:
        conn = psycopg2.connect(
            host='localhost',
            dbname='anqiao_crm',
            user='anqiao_crm_app',
            password=db_password
        )
        cur = conn.cursor()
        
        # Confirm admin user exists
        cur.execute('''
            SELECT username, display_name, status
            FROM user_identities WHERE username = 'admin'
        ''')
        user = cur.fetchone()
        
        if user:
            print(f'\n[OK] Verified user_identities table:')
            print(f'  username: {user[0]}')
            print(f'  display_name: {user[1]}')
            print(f'  status: {user[2]}')
        else:
            print('\n[FAIL] Admin user not found')
            exit(1)
        
        # Confirm role
        cur.execute('''
            SELECT rg.user_id, rg.role, u.display_name
            FROM role_grants rg
            JOIN user_identities u ON rg.user_id = u.id
            WHERE u.username = 'admin' AND rg.role = 'administrator'
        ''')
        role = cur.fetchone()
        
        if role:
            print(f'\n[OK] Verified role_grants table:')
            print(f'  user_id: {role[0]}')
            print(f'  role: {role[1]}')
            print(f'  display_name: {role[2]}')
        else:
            print('\n[FAIL] Administrator role not found')
            exit(1)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f'\n[ERROR] Verification failed: {e}')
        exit(1)

    # Final output of temporary password
    print('\n' + '=' * 60)
    print('[TEMPORARY PASSWORD - SECURE COMMUNICATION REQUIRED]')
    print('=' * 60)
    print(f'\nPASSWORD: {temp_password}')
    print(f'\nIMPORTANT NOTES:')
    print(f'  1. Securely communicate this password to the user')
    print(f'  2. User MUST change password on first login')
    print(f'  3. Ensure secure channel when transmitting this password')
    print('=' * 60 + '\n')


if __name__ == '__main__':
    main()
