"""Database mappings, repositories, and lifecycle integration."""

from crm.persistence.base import Base
from crm.persistence.database import build_engine, build_session_factory, transaction_session
from crm.persistence.models import (
    AuditEventModel,
    ContactModel,
    FollowUpActivityModel,
    FollowUpActivityRevisionModel,
    InstitutionModel,
    InstitutionOwnerHistoryModel,
    RoleGrantModel,
    ServerSessionModel,
    UserIdentityModel,
)

__all__ = [
    "AuditEventModel",
    "Base",
    "ContactModel",
    "FollowUpActivityModel",
    "FollowUpActivityRevisionModel",
    "InstitutionModel",
    "InstitutionOwnerHistoryModel",
    "RoleGrantModel",
    "ServerSessionModel",
    "UserIdentityModel",
    "build_engine",
    "build_session_factory",
    "transaction_session",
]
