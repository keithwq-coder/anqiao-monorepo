"""Management commands for SPEC-0002 user, role, and ownership management.

TASK-0015: audited role grant/revoke, user enable/disable, single+batch
ownership transfer. Each command writes its audit event with before_state/
after_state JSON inside the same transaction as the state change (R-005).
Authorization (ADMINISTRATOR-only, self-action prohibitions) is enforced by
the route layer before the command runs.

All non-primary-key lookups are delegated to ManagementRepository methods
(in repositories.py) which use SQLAlchemy's parameterized filter_by queries.
"""

from datetime import datetime, timezone
from uuid import UUID

from crm.domain.models import Role, UserStatus
from crm.persistence.models import (
    AuditEventModel,
    InstitutionModel,
    InstitutionOwnerHistoryModel,
    RoleGrantModel,
    UserIdentityModel,
)


def _default_session_factory():
    from crm.config import Settings
    from crm.persistence.database import get_session_factory
    return get_session_factory(Settings())


def _mgmt_repo():
    from crm.persistence.repositories import ManagementRepository
    return ManagementRepository()


def _audit_mgmt(session, action, actor, ttype, tid, reason, before=None, after=None, summary=None):
    """Write an audit event with before/after state inside the caller's tx."""
    session.add(AuditEventModel(
        actor_user_id=actor, action=action, target_type=ttype, target_id=tid,
        outcome="success", reason=reason, before_state=before, after_state=after,
        failure_summary=summary,
    ))


class GrantRoleCommand:
    """Grant a role to a user (R-005, AC-003). Idempotent."""

    def __init__(self, target_user_id, role, granted_by_user_id, reason, scope_reference=None):
        self.target_user_id = target_user_id
        self.role = role
        self.granted_by_user_id = granted_by_user_id
        self.reason = reason
        self.scope_reference = scope_reference

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        repo = _mgmt_repo()
        uid = self.target_user_id
        rval = self.role.value
        scope = self.scope_reference
        with transaction_session(factory) as session:
            existing = repo.find_active_role_grant(
                session=session, user_id=uid, role=rval, scope_reference=scope,
            )
            if existing is not None:
                return {"user_id": str(uid), "role": rval,
                        "scope_reference": scope, "granted": False, "idempotent": True}

            if self.role is Role.MANAGER and not (scope or "").strip():
                raise ValueError("manager role requires an explicit scope")

            before = {"active_grants": [
                {"role": g.role, "scope": g.scope_reference}
                for g in repo.find_active_role_grants(session=session, user_id=uid)
            ]}

            grant = RoleGrantModel(
                user_id=uid, role=rval, scope_reference=scope,
                granted_by_user_id=self.granted_by_user_id, reason=self.reason,
            )
            session.add(grant)
            session.flush()

            after = {"active_grants": [
                {"role": g.role, "scope": g.scope_reference}
                for g in repo.find_active_role_grants(session=session, user_id=uid)
            ]}

            _audit_mgmt(session, "role.grant", self.granted_by_user_id,
                        "user_identity", uid, self.reason, before, after)

            return {"user_id": str(uid), "role": rval,
                    "scope_reference": scope, "granted": True, "grant_id": str(grant.id)}


class RevokeRoleCommand:
    """Revoke a role from a user (R-005, AC-003). Idempotent. Bumps epoch (R-014)."""

    def __init__(self, target_user_id, role, revoked_by_user_id, reason, scope_reference=None):
        self.target_user_id = target_user_id
        self.role = role
        self.revoked_by_user_id = revoked_by_user_id
        self.reason = reason
        self.scope_reference = scope_reference

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        repo = _mgmt_repo()
        uid = self.target_user_id
        rval = self.role.value
        scope = self.scope_reference
        with transaction_session(factory) as session:
            grant = repo.find_active_role_grant(
                session=session, user_id=uid, role=rval, scope_reference=scope,
            )
            if grant is None:
                return {"user_id": str(uid), "role": rval,
                        "revoked": False, "idempotent": True}

            before = {"role": grant.role, "scope": grant.scope_reference, "revoked_at": None}
            grant.revoked_at = datetime.now(timezone.utc)
            grant.revoked_by_user_id = self.revoked_by_user_id
            grant.revocation_reason = self.reason
            after = {"role": grant.role, "scope": grant.scope_reference,
                     "revoked_at": grant.revoked_at.isoformat(), "revocation_reason": self.reason}

            user_model = session.get(UserIdentityModel, uid)
            if user_model is not None:
                user_model.session_epoch = (user_model.session_epoch or 0) + 1

            _audit_mgmt(session, "role.revoke", self.revoked_by_user_id,
                        "user_identity", uid, self.reason, before, after)

            return {"user_id": str(uid), "role": rval,
                    "revoked": True, "revoked_at": grant.revoked_at.isoformat()}


class EnableUserCommand:
    """Enable a user account (R-004, R-005, AC-003)."""

    def __init__(self, target_user_id, enabled_by_user_id, reason):
        self.target_user_id = target_user_id
        self.enabled_by_user_id = enabled_by_user_id
        self.reason = reason

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        uid = self.target_user_id
        with transaction_session(factory) as session:
            model = session.get(UserIdentityModel, uid)
            if model is None:
                raise ValueError("user not found")
            before = {"status": model.status, "session_epoch": model.session_epoch}
            model.status = UserStatus.ENABLED.value
            model.updated_at = datetime.now(timezone.utc)
            after = {"status": model.status, "session_epoch": model.session_epoch}
            _audit_mgmt(session, "user.enable", self.enabled_by_user_id,
                        "user_identity", uid, self.reason, before, after)
            return {"user_id": str(uid), "status": model.status, "enabled": True}


class DisableUserCommand:
    """Disable a user account (R-004, R-005, R-014, AC-004). Bumps epoch."""

    def __init__(self, target_user_id, disabled_by_user_id, reason, owned_institution_ids=None):
        self.target_user_id = target_user_id
        self.disabled_by_user_id = disabled_by_user_id
        self.reason = reason
        self.owned_institution_ids = owned_institution_ids or []

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        uid = self.target_user_id
        with transaction_session(factory) as session:
            model = session.get(UserIdentityModel, uid)
            if model is None:
                raise ValueError("user not found")
            before = {"status": model.status, "session_epoch": model.session_epoch}
            model.status = UserStatus.DISABLED.value
            model.session_epoch = (model.session_epoch or 0) + 1
            model.updated_at = datetime.now(timezone.utc)
            after = {"status": model.status, "session_epoch": model.session_epoch}
            summary = (f"owned_institutions:{len(self.owned_institution_ids)}"
                       if self.owned_institution_ids else None)
            _audit_mgmt(session, "user.disable", self.disabled_by_user_id,
                        "user_identity", uid, self.reason, before, after, summary)
            return {"user_id": str(uid), "status": model.status,
                    "disabled": True,
                    "owned_institution_ids": [str(i) for i in self.owned_institution_ids]}


class TransferOwnershipCommand:
    """Transfer ownership of a single institution (R-009, R-010, AC-005, AC-006)."""

    def __init__(self, institution_id, new_owner_user_id, transferred_by_user_id, reason):
        self.institution_id = institution_id
        self.new_owner_user_id = new_owner_user_id
        self.transferred_by_user_id = transferred_by_user_id
        # R-026 (SPEC-0002 v0.4.0): the administrator may assign without a
        # reason (auto-traced in audit_events); gm reason-required is
        # enforced at the route layer. Blank/whitespace is normalized to None.
        self.reason = (reason or "").strip() or None

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        repo = _mgmt_repo()
        iid = self.institution_id
        new_owner_id = self.new_owner_user_id
        with transaction_session(factory) as session:
            inst = session.get(InstitutionModel, iid)
            if inst is None:
                raise ValueError("institution not found")
            prev = inst.owner_user_id
            if prev == new_owner_id:
                return {"institution_id": str(iid), "transferred": False,
                        "idempotent": True, "previous_owner_user_id": str(prev),
                        "new_owner_user_id": str(new_owner_id)}

            new_owner = session.get(UserIdentityModel, new_owner_id)
            if new_owner is None:
                raise ValueError("new owner not found")
            if new_owner.status != UserStatus.ENABLED.value:
                raise ValueError("new owner is not enabled")

            roles = repo.find_active_role_values(session=session, user_id=new_owner_id)
            has_biz = any(r in (Role.BUSINESS_USER.value, Role.ADMINISTRATOR.value) for r in roles)
            if not has_biz:
                raise ValueError("new owner has no business role")

            before = {"owner_user_id": str(prev)}
            history = InstitutionOwnerHistoryModel(
                institution_id=iid, previous_owner_user_id=prev,
                new_owner_user_id=new_owner_id,
                transferred_by_user_id=self.transferred_by_user_id, reason=self.reason,
            )
            session.add(history)
            inst.owner_user_id = new_owner_id
            inst.updated_at = datetime.now(timezone.utc)
            after = {"owner_user_id": str(new_owner_id)}
            _audit_mgmt(session, "institution.transfer_ownership", self.transferred_by_user_id,
                        "institution", iid, self.reason, before, after)
            return {"institution_id": str(iid), "transferred": True,
                    "previous_owner_user_id": str(prev),
                    "new_owner_user_id": str(new_owner_id), "reason": self.reason}


class BatchTransferOwnershipCommand:
    """Batch transfer ownership (R-011, R-012, AC-007). Per-item txns."""

    def __init__(self, institution_ids, new_owner_user_id, transferred_by_user_id, reason):
        self.institution_ids = institution_ids
        self.new_owner_user_id = new_owner_user_id
        self.transferred_by_user_id = transferred_by_user_id
        self.reason = reason

    def execute(self, session_factory=None):
        factory = session_factory or _default_session_factory()
        new_owner_id = self.new_owner_user_id
        results = []
        ok = 0
        fail = 0
        for iid in self.institution_ids:
            single = TransferOwnershipCommand(iid, new_owner_id,
                                              self.transferred_by_user_id, self.reason)
            try:
                out = single.execute(factory)
                results.append({"institution_id": str(iid), "success": True,
                                "transferred": out.get("transferred", False),
                                "idempotent": out.get("idempotent", False), "error": None})
                ok += 1
            except ValueError as exc:
                results.append({"institution_id": str(iid), "success": False,
                                "transferred": False, "idempotent": False, "error": str(exc)})
                fail += 1
        return {"total": len(self.institution_ids), "succeeded": ok,
                "failed": fail, "results": results}


class ReleaseToPoolCommand:
    """R-041 (SPEC-0001 v0.8.0): admin/gm release a customer to the public pool.

    The owner becomes None and ``in_pool`` becomes True; the owner history
    records (previous_owner -> None) with a required reason; an audit event is
    written in the same transaction. A record already in the pool is an
    idempotent no-op.
    """

    def __init__(self, institution_id, released_by_user_id, reason):
        self.institution_id = institution_id
        self.released_by_user_id = released_by_user_id
        self.reason = (reason or "").strip()

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        iid = self.institution_id
        with transaction_session(factory) as session:
            inst = session.get(InstitutionModel, iid)
            if inst is None:
                raise ValueError("institution not found")
            if inst.archived_at is not None:
                raise ValueError("archived institution cannot be released to pool")
            if inst.in_pool:
                return {"institution_id": str(iid), "released": False,
                        "idempotent": True,
                        "previous_owner_user_id": None}
            if not self.reason:
                raise ValueError("releasing to the pool requires a reason")

            prev = inst.owner_user_id
            before = {"owner_user_id": str(prev) if prev else None, "in_pool": False}
            history = InstitutionOwnerHistoryModel(
                institution_id=iid, previous_owner_user_id=prev,
                new_owner_user_id=None,
                transferred_by_user_id=self.released_by_user_id, reason=self.reason,
            )
            session.add(history)
            inst.owner_user_id = None
            inst.in_pool = True
            inst.updated_at = datetime.now(timezone.utc)
            after = {"owner_user_id": None, "in_pool": True}
            _audit_mgmt(session, "institution.release_to_pool", self.released_by_user_id,
                        "institution", iid, self.reason, before, after)
            return {"institution_id": str(iid), "released": True,
                    "previous_owner_user_id": str(prev) if prev else None}


class ClaimFromPoolCommand:
    """R-043 (SPEC-0001 v0.8.0): a business_user claims a pool customer.

    The claimant becomes the owner and ``in_pool`` becomes False; the owner
    history records (None -> claimant); an audit event is written in the same
    transaction. Concurrent claims: the second claimant finds the record no
    longer in the pool and fails (no double owner).
    """

    def __init__(self, institution_id, claimant_user_id, reason="认领公池客户"):
        self.institution_id = institution_id
        self.claimant_user_id = claimant_user_id
        self.reason = (reason or "").strip() or "认领公池客户"

    def execute(self, session_factory=None):
        from crm.persistence.database import transaction_session
        factory = session_factory or _default_session_factory()
        iid = self.institution_id
        with transaction_session(factory) as session:
            inst = session.get(InstitutionModel, iid)
            if inst is None:
                raise ValueError("institution not found")
            if inst.archived_at is not None:
                raise ValueError("archived institution cannot be claimed")
            if not inst.in_pool:
                raise ValueError("institution is not in the pool")

            claimant = session.get(UserIdentityModel, self.claimant_user_id)
            if claimant is None:
                raise ValueError("claimant not found")
            if claimant.status != UserStatus.ENABLED.value:
                raise ValueError("claimant is not enabled")

            before = {"owner_user_id": None, "in_pool": True}
            history = InstitutionOwnerHistoryModel(
                institution_id=iid, previous_owner_user_id=None,
                new_owner_user_id=self.claimant_user_id,
                transferred_by_user_id=self.claimant_user_id, reason=self.reason,
            )
            session.add(history)
            inst.owner_user_id = self.claimant_user_id
            inst.in_pool = False
            inst.updated_at = datetime.now(timezone.utc)
            after = {"owner_user_id": str(self.claimant_user_id), "in_pool": False}
            _audit_mgmt(session, "institution.claim_from_pool", self.claimant_user_id,
                        "institution", iid, self.reason, before, after)
            return {"institution_id": str(iid), "claimed": True,
                    "new_owner_user_id": str(self.claimant_user_id)}
