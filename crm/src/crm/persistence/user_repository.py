"""Persistence layer repositories for core entities."""

import sqlalchemy as sa
from typing import Optional, List
from uuid import UUID

from crm.persistence.models import (
    UserIdentityModel,
    InstitutionModel,
    ContactModel,
    FollowUpActivityModel,
    ServerSessionModel,
    RoleGrantModel
)
from crm.domain.models import (
    UserIdentity,
    UserStatus,
    Role,
    ContactabilityStatus,
    ContentAttribution,
    AiReviewStatus
)


def domain_user_from_model(model: UserIdentityModel) -> UserIdentity:
    """Convert SQLAlchemy model to domain model."""
    return UserIdentity(
        username=model.username,
        display_name=model.display_name,
        password_hash=model.password_hash,
        status=UserStatus(model.status),
        id=model.id,
        session_epoch=model.session_epoch,
        phone=model.phone,
        created_at=model.created_at,
        updated_at=model.updated_at
    )


class UserRepository:
    """Repository for user identity management."""
    
    def find_by_id(self, user_id: UUID) -> Optional[UserIdentity]:
        """Find user by ID."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            model = session.get(UserIdentityModel, user_id)
            if model:
                return domain_user_from_model(model)
            return None
    
    def find_by_username(self, username: str) -> Optional[UserIdentity]:
        """Find user by username (case-insensitive)."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            result = session.execute(
                sa.select(UserIdentityModel).where(
                    sa.func.lower(UserIdentityModel.username) == username.casefold()
                )
            ).scalar_one_or_none()
            
            if result:
                return domain_user_from_model(result)
            return None
    
    def find_all_active(self) -> List[UserIdentity]:
        """Find all enabled users."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            models = session.execute(
                sa.select(UserIdentityModel).where(UserIdentityModel.status == 'enabled')
            ).scalars().all()
            
            return [domain_user_from_model(m) for m in models]
    
    def create(
        self,
        username: str,
        display_name: str,
        password_hash: str,
        status: UserStatus = UserStatus.PENDING,
        phone: str | None = None,
    ) -> UserIdentity:
        """Create a new user."""
        from crm.persistence.database import SessionLocal
        from datetime import datetime, timezone
        
        model = UserIdentityModel(
            username=username,
            display_name=display_name,
            password_hash=password_hash,
            status=status.value,
            phone=phone,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        with SessionLocal() as session:
            session.add(model)
            session.commit()
            session.refresh(model)
            return domain_user_from_model(model)
    
    def disable_user(self, user_id: UUID) -> bool:
        """Disable a user by setting status to DISABLED.
        
        Returns True if user was found and disabled, False if user not found.
        This immediately invalidates all existing sessions for this user per DEC-0044.
        """
        from crm.persistence.database import SessionLocal
        from datetime import datetime, timezone
        
        with SessionLocal() as session:
            model = session.get(UserIdentityModel, user_id)
            if not model:
                return False
            
            model.status = UserStatus.DISABLED.value
            model.updated_at = datetime.now(timezone.utc)
            session.commit()
            return True
    
    def bump_session_epoch(self, user_id: UUID) -> bool:
        """Increment user's session_epoch to invalidate all existing sessions.
        
        Returns True if user was found and epoch incremented, False if user not found.
        This implements forced logout per DEC-0044: any session with stale epoch
        will be rejected on next validate_session() call.
        """
        from crm.persistence.database import SessionLocal
        from datetime import datetime, timezone
        
        with SessionLocal() as session:
            model = session.get(UserIdentityModel, user_id)
            if not model:
                return False
            
            # Increment epoch to invalidate all sessions
            model.session_epoch = (model.session_epoch or 0) + 1
            model.updated_at = datetime.now(timezone.utc)
            session.commit()
            
            return True
