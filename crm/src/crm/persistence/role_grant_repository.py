"""Role grant loading for the canonical policy identity (SPEC-0002 R-013).

Active grants (``revoked_at IS NULL``) define a user's roles and, for the
manager role, the management scope keys used by the policy projection
(DEC-0051). Users without grants simply have none; deny-by-default is
enforced by the policy layer (R-003, R-006).
"""

from uuid import UUID

import sqlalchemy as sa

from crm.domain.models import Role
from crm.persistence.models import RoleGrantModel


class RoleGrantRepository:
    """Repository for reading role grants over ``role_grants``."""

    def find_active_roles(self, user_id: UUID) -> tuple[frozenset, frozenset]:
        """Return ``(roles, management_scope_keys)`` from active grants.

        Manager grants contribute their ``scope_reference`` as a management
        scope key; other roles carry no scope. Revoked grants are ignored.
        """
        from crm.persistence.database import SessionLocal

        with SessionLocal() as session:
            rows = session.execute(
                sa.select(RoleGrantModel.role, RoleGrantModel.scope_reference).where(
                    RoleGrantModel.user_id == user_id,
                    RoleGrantModel.revoked_at.is_(None),
                )
            ).all()

        roles = frozenset(Role(role_value) for role_value, _ in rows)
        scope_keys = frozenset(
            scope_reference
            for role_value, scope_reference in rows
            if role_value == Role.MANAGER.value and scope_reference
        )
        return roles, scope_keys
