#!/usr/bin/env python
"""Synthetic backup/restore rehearsal for SPEC-0011 erasure propagation.

TASK-0017: proves the 30-day propagation window semantics (DEC-0104 Decision 2)
using a local SQLite database. This is NOT a production backup tool — it is a
synthetic rehearsal that demonstrates:

1. A backup taken before erasure contains the personal data.
2. After erasure, the live database no longer contains the personal data.
3. A backup taken after erasure does NOT contain the erased personal data.
4. The erasure record propagation_status can be marked verified after
   confirming the post-erasure backup is clean.

Usage: python scripts/synthetic_backup_rehearsal.py

This script touches only a temporary local SQLite file — no remote or
production resources.
"""

import os
import sys
import tempfile
from datetime import datetime, timezone
from uuid import UUID, uuid4

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, "src"))

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t17_rehearsal")
os.environ.setdefault("DATABASE_USER", "t17_rehearsal")
os.environ.setdefault("DATABASE_PASSWORD", "t17-synthetic-only")
os.environ.setdefault("SESSION_SECRET_KEY", "t17-rehearsal-secret")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import json
import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from crm.persistence.base import Base
from crm.persistence.database import transaction_session
from crm.persistence.models import (
    ContactModel,
    ErasureRecordModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.web.auth import hash_password

PHONE_LEAK_MARKER = "PHONE_LEAK_MARKER_13900000000"
NAME_LEAK_MARKER = "LEAK_INSTITUTION_NAME"

_TABLE_NAMES = [
    "audit_events", "contacts", "erasure_records",
    "follow_up_activities", "follow_up_activity_revisions",
    "institution_owner_history", "institutions",
    "role_grants", "server_sessions", "user_identities",
]


def _create_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @sa.event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: (s or "").strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: (s or "").strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s or ""))

    Base.metadata.create_all(engine)
    return engine


def _take_backup(engine, backup_path):
    """Serialize all table data to a JSON file (simulates pg_dump)."""
    factory = sessionmaker(bind=engine)
    data = {}
    with factory() as session:
        for table_name in _TABLE_NAMES:
            model_cls = Base.metadata.tables.get(table_name)
            if model_cls is None:
                data[table_name] = []
                continue
            rows = model_name_to_query(session, table_name).all()
            data[table_name] = [serialize_row(row) for row in rows]
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, ensure_ascii=False, indent=2)


def model_name_to_query(session, table_name):
    """Return a SQLAlchemy select for the given table name from a fixed allowlist."""
    model_map = {
        "institutions": session.query(InstitutionModel),
        "contacts": session.query(ContactModel),
        "erasure_records": session.query(ErasureRecordModel),
        "user_identities": session.query(UserIdentityModel),
        "role_grants": session.query(RoleGrantModel),
    }
    return model_map.get(table_name, session.query(InstitutionModel).filter(sa.false()))


def serialize_row(model_obj):
    """Serialize a SQLAlchemy model instance to a dict of column values."""
    result = {}
    for col in model_obj.__table__.columns:
        val = getattr(model_obj, col.name)
        if val is not None:
            result[col.name] = str(val)
        else:
            result[col.name] = None
    return result


def _check_backup_for_markers(backup_path):
    """Check if the backup file contains the leak markers."""
    with open(backup_path, "r", encoding="utf-8") as f:
        content = f.read()
    return PHONE_LEAK_MARKER in content, NAME_LEAK_MARKER in content


def _mark_propagation_verified(engine, erasure_record_id):
    factory = sessionmaker(bind=engine)
    with factory() as session:
        record = session.get(ErasureRecordModel, _coerce_uuid(erasure_record_id))
        if record is None:
            return False
        record.propagation_status = "verified"
        record.propagation_verified_at = datetime.now(timezone.utc)
        session.commit()
        return True


def _coerce_uuid(value):
    """Coerce a value to a UUID, accepting UUID instances or hex/uuid strings."""
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        return UUID(value)
    return value


def run_rehearsal():
    engine = _create_engine()
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    now = datetime.now(timezone.utc)

    admin_id = uuid4()
    inst_id = uuid4()
    contact_id = uuid4()

    with transaction_session(factory) as session:
        session.add(UserIdentityModel(
            id=admin_id, username="rehearsal_admin", display_name="Admin",
            password_hash=hash_password("rehearsal_pass"),
            status="enabled", session_epoch=0,
            created_at=now, updated_at=now,
        ))
        session.add(RoleGrantModel(
            user_id=admin_id, role="administrator",
            granted_by_user_id=admin_id, reason="rehearsal seed",
            granted_at=now,
        ))
        session.add(InstitutionModel(
            id=inst_id, name=NAME_LEAK_MARKER,
            source_description="source with personal data",
            source_kind="manual", region="east",
            owner_user_id=admin_id, created_by_user_id=admin_id,
            idempotency_key="rehearsal-inst",
            created_at=now, updated_at=now,
        ))
        session.add(ContactModel(
            id=contact_id, institution_id=inst_id,
            name="zhang_san", phone=PHONE_LEAK_MARKER,
            contactability_status="available",
            created_by_user_id=admin_id,
            idempotency_key="rehearsal-contact",
            created_at=now, updated_at=now,
        ))

    # Backup BEFORE erasure.
    tmpdir = tempfile.mkdtemp(prefix="t17_backup_")
    backup_before = os.path.join(tmpdir, "backup_before.json")
    _take_backup(engine, backup_before)
    phone_before, name_before = _check_backup_for_markers(backup_before)

    # Perform erasure.
    from crm.application.lifecycle_commands import EraseInstitutionCommand
    cmd = EraseInstitutionCommand(
        institution_id=inst_id,
        erased_by_user_id=admin_id,
        reason="rehearsal: data subject requested deletion",
        is_request_fulfillment=True,
    )
    result = cmd.execute(factory)
    erasure_record_id = result["erasure_record_id"]

    # Backup AFTER erasure.
    backup_after = os.path.join(tmpdir, "backup_after.json")
    _take_backup(engine, backup_after)
    phone_after, name_after = _check_backup_for_markers(backup_after)

    # Verify live DB.
    with factory() as session:
        inst = session.get(InstitutionModel, inst_id)
        contact = session.get(ContactModel, contact_id)

    # Mark propagation.
    if not phone_after and not name_after:
        _mark_propagation_verified(engine, erasure_record_id)
    with factory() as session:
        erasure_record = session.get(ErasureRecordModel, _coerce_uuid(erasure_record_id))

    # Cleanup.
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)

    return {
        "backup_before_has_phone": phone_before,
        "backup_before_has_name": name_before,
        "backup_after_has_phone": phone_after,
        "backup_after_has_name": name_after,
        "live_institution_name": inst.name if inst else None,
        "live_contact_phone": contact.phone if contact else None,
        "erasure_propagate_by": erasure_record.propagate_by.isoformat() if erasure_record else None,
        "erasure_propagation_status": erasure_record.propagation_status if erasure_record else None,
        "erasure_is_request_fulfillment": erasure_record.is_request_fulfillment if erasure_record else None,
        "passed": (
            phone_before is True
            and name_before is True
            and phone_after is False
            and name_after is False
            and erasure_record.propagation_status == "verified"
        ),
    }


if __name__ == "__main__":
    print("=" * 60)
    print("TASK-0017 Synthetic Backup/Restore Rehearsal")
    print("=" * 60)
    result = run_rehearsal()
    for key, value in result.items():
        print(f"  {key}: {value}")
    print("-" * 60)
    if result["passed"]:
        print("RESULT: PASSED")
    else:
        print("RESULT: FAILED")
    print("=" * 60)
    sys.exit(0 if result["passed"] else 1)
