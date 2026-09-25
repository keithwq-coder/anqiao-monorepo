"""Create initial admin user for testing."""

import asyncio
from crm.persistence.user_repository import UserRepository
from crm.domain.models import User, Role, UserStatus
from crm.web.auth import hash_password


async def create_admin_user():
    """Create a test admin user if it doesn't exist."""
    
    print("🔧 Creating initial admin user...")
    
    # Initialize repository
    user_repo = UserRepository()
    
    # Check if admin exists
    existing = await user_repo.find_by_username("admin")
    if existing:
        print("✅ Admin user already exists")
        return
    
    # Create admin user
    password = "admin123"  # Default test password - CHANGE IN PRODUCTION!
    password_hash = hash_password(password)
    
    admin = User(
        id="admin-001",  # Fixed ID for testing
        username="admin",
        email="admin@anqiao.com",
        full_name="系统管理员",
        role=Role.ADMIN,
        status=UserStatus.ENABLED,
        password_hash=password_hash
    )
    
    # Save to database
    user_repo.save(admin)
    
    print(f"✅ Admin user created successfully!")
    print(f"   Username: admin")
    print(f"   Password: admin123")
    print(f"   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!")


if __name__ == "__main__":
    asyncio.run(create_admin_user())
