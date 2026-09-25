#!/usr/bin/env python
"""Local synthetic operations evidence helper (SPEC-0012 §6, §8, §9).

TASK-0018: produces durable, locally inspectable evidence for the
fail-closed operational contracts — backup, restore rehearsal,
deployment change, and rollback — using a file-backed local SQLite
database.

This is NOT a production backup tool. It demonstrates that:
  1. A backup record is durable and inspectable locally: the source
     database is a file-backed SQLite file that is closed and reopened
     with a fresh engine before the records are listed.
  2. A restore rehearsal is a real local rehearsal: the backup artifact
     is restored into a separate fresh database and at least one seeded
     persisted record is verified from that restored database.
  3. A SPEC-0011 deletion propagation to the backup is recorded as
     verified, or marked incomplete — never success when unverified
     (SPEC-0012 R-005 / AC-005).
  4. A deployment change and its rollback leave auditable records.
  5. Fail-closed semantics: a failed or unverified operation is never
     recorded as success (SPEC-0012 §8).

No secret is stored. The database password is supplied as a synthetic
placeholder; all output uses non-sensitive classification text only.

Usage:
    python scripts/operations_evidence.py

This script touches only temporary local SQLite files — no remote or
production resources.
"""

from __future__ import annotations

import os
import sys
import tempfile
import shutil
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, "src"))

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t18_ops_evidence")
os.environ.setdefault("DATABASE_USER", "t18_ops_evidence")
os.environ.setdefault("DATABASE_PASSWORD", "t18-synthetic-only-placeholder")
os.environ.setdefault("SESSION_SECRET_KEY", "t18-ops-evidence-secret")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from crm.persistence.base import Base
from crm.persistence.models import (
    ErasureRecordModel,
    OperationRecordModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.web.auth import hash_password


def create_sqlite_engine(db_path):
    """Create a file-backed SQLite engine with PostgreSQL-like functions.

    The database file persists on disk. Closing this engine and creating a
    new one against the same path yields the same durable data; the
    close/reopen durability proof in ``run_evidence`` relies on this. No
    in-memory ``sqlite://`` / ``StaticPool`` engine is used.
    """
    engine = create_engine(
        "sqlite:///" + os.fspath(db_path).replace("\\", "/"),
        connect_args={"check_same_thread": False},
    )

    @sa.event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: (s or "").strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: (s or "").strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s or ""))

    Base.metadata.create_all(engine)
    return engine


def _serialize_value(value):
    """Serialize one value for the JSON backup artifact (round-trip safe)."""
    if value is None:
        return None
    if isinstance(value, (datetime, timedelta)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def _coerce_value(column, value):
    """Coerce a serialized backup value back to what ``column`` expects."""
    if value is None:
        return None
    if isinstance(column.type, sa.Uuid):
        return UUID(value)
    if isinstance(column.type, sa.DateTime):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(column.type, sa.Boolean):
        return value in ("1", "true", "True", 1, True)
    return value


def _seed_admin_user(factory):
    """Seed one administrator user for operation actor linkage."""
    now = datetime.now(timezone.utc)
    admin_id = uuid4()
    with factory() as session:
        session.add(UserIdentityModel(
            id=admin_id,
            username="ops_admin",
            display_name="Operations Admin",
            password_hash=hash_password("ops-synthetic-only"),
            status="enabled",
            session_epoch=0,
            created_at=now,
            updated_at=now,
        ))
        session.add(RoleGrantModel(
            user_id=admin_id,
            role="administrator",
            granted_by_user_id=admin_id,
            reason="operations evidence seed",
            granted_at=now,
        ))
        session.commit()
    return admin_id


def _record_operation(
    factory,
    *,
    operation_type: str,
    action: str,
    target_description: str,
    outcome: str,
    actor_user_id: UUID,
    detail_summary: str | None = None,
    failure_summary: str | None = None,
):
    """Write one operation record and return its id."""
    now = datetime.now(timezone.utc)
    record_id = uuid4()
    completed_at = now if outcome != "unverified" else None
    with factory() as session:
        session.add(OperationRecordModel(
            id=record_id,
            operation_type=operation_type,
            actor_user_id=actor_user_id,
            action=action,
            target_description=target_description,
            outcome=outcome,
            detail_summary=detail_summary,
            failure_summary=failure_summary,
            occurred_at=now,
            completed_at=completed_at,
        ))
        session.commit()
    return record_id


def _list_operations(factory):
    """Return all operation records ordered newest-first."""
    with factory() as session:
        rows = (
            session.query(OperationRecordModel)
            .order_by(OperationRecordModel.occurred_at.desc())
            .all()
        )
        return [
            {
                "id": str(r.id),
                "operation_type": r.operation_type,
                "action": r.action,
                "target_description": r.target_description,
                "outcome": r.outcome,
                "detail_summary": r.detail_summary,
                "failure_summary": r.failure_summary,
                "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in rows
        ]


def _take_synthetic_backup(factory, backup_path):
    """Serialize all table data to a JSON file (simulates pg_dump)."""
    data = {}
    with factory() as session:
        for table_name in [
            "operation_records",
            "user_identities",
            "role_grants",
            "erasure_records",
        ]:
            table = Base.metadata.tables.get(table_name)
            if table is None:
                data[table_name] = []
                continue
            rows = session.execute(sa.select(table)).all()
            data[table_name] = [
                {col: _serialize_value(val) for col, val in row._mapping.items()}
                for row in rows
            ]
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, ensure_ascii=False, indent=2)


def perform_restore_rehearsal(backup_path, restore_db_path):
    """Restore a backup artifact into a separate fresh database.

    Returns ``(ok, failure_summary)``. ``ok`` is True only when the backup
    file parses, its data is loaded into a brand-new database at
    ``restore_db_path``, and at least one seeded persisted record (the
    synthetic admin user) is verified from the restored database. A missing
    or corrupt backup yields ``(False, reason)`` — a restore that must
    never be recorded as success (SPEC-0012 §8).
    """
    try:
        with open(backup_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        return False, f"backup could not be read or parsed: {type(exc).__name__}"

    if not isinstance(data, dict) or not data:
        return False, "backup contains no tables to restore"

    # Fresh restore target: remove any prior file so this is a true restore
    # into a brand-new database.
    if os.path.exists(restore_db_path):
        try:
            os.remove(restore_db_path)
        except OSError as exc:
            return False, f"could not prepare fresh restore database: {type(exc).__name__}"

    restore_engine = create_sqlite_engine(restore_db_path)
    try:
        restore_factory = sessionmaker(
            bind=restore_engine, expire_on_commit=False, autoflush=False
        )
        # Insert parent tables before child tables for FK ordering.
        for table_name in (
            "user_identities",
            "role_grants",
            "operation_records",
            "erasure_records",
        ):
            rows = data.get(table_name)
            if not rows:
                continue
            table = Base.metadata.tables.get(table_name)
            if table is None:
                continue
            with restore_factory() as session:
                for row in rows:
                    coerced = {
                        col: _coerce_value(table.c[col], val)
                        for col, val in row.items()
                        if col in table.c
                    }
                    session.execute(table.insert().values(**coerced))
                session.commit()

        with restore_factory() as session:
            admin = (
                session.query(UserIdentityModel)
                .filter(UserIdentityModel.username == "ops_admin")
                .first()
            )
        if admin is None:
            return False, "restored database contains no seeded persisted user record"
        return True, None
    except Exception as exc:
        return False, f"restore into fresh database failed: {type(exc).__name__}"
    finally:
        restore_engine.dispose()


def _simulate_deletion_propagation(factory, backup_path, admin_id):
    """Simulate SPEC-0011 erasure propagation to the synthetic backup.

    Seeds two synthetic erasure records (SPEC-0011 ``erasure_records``) in
    the source and rewrites the backup so both are present. One erasure is
    then marked ``verified`` in the backup copy (propagated within the
    bounded window); the other stays ``pending`` and is later recorded as
    ``unverified`` — marked incomplete, never success (SPEC-0012 §8/AC-005).

    Returns ``(verified_id, pending_id)``.
    """
    now = datetime.now(timezone.utc)
    verified_id = uuid4()
    pending_id = uuid4()
    with factory() as session:
        for erasure_id in (verified_id, pending_id):
            session.add(ErasureRecordModel(
                id=erasure_id,
                target_type="contact",
                target_id=uuid4(),
                erased_by_user_id=admin_id,
                erasure_reason="synthetic erasure for backup propagation evidence",
                erasure_scope="synthetic contact row",
                erased_at=now,
                propagate_by=now + timedelta(days=30),
                propagation_status="pending",
                is_request_fulfillment=False,
            ))
        session.commit()

    _take_synthetic_backup(factory, backup_path)

    # Mark the first erasure as propagated within the bounded window.
    with open(backup_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for row in data["erasure_records"]:
        if row["id"] == str(verified_id):
            row["propagation_status"] = "verified"
            row["propagation_verified_at"] = datetime.now(timezone.utc).isoformat()
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, ensure_ascii=False, indent=2)

    return verified_id, pending_id


def run_evidence(workdir=None):
    """Run the full local synthetic operations evidence sequence.

    ``workdir`` may be a caller-provided directory (tests pass their own
    temporary directory and own cleanup). When omitted, a temporary
    directory is created and removed at the end — no generated database or
    backup artifact is ever left behind or committed.

    Sequence:
      1. Create a file-backed source database and seed an admin user.
      2. Take a backup artifact -> record success.
      3. Perform a real restore rehearsal into a separate fresh database
         and verify the seeded record from the restored database ->
         record result.
      4. Simulate SPEC-0011 deletion propagation to the backup: one
         erasure verified within the bounded window -> record success;
         one erasure still pending -> record 'unverified' (marked
         incomplete, never success — SPEC-0012 §8/AC-005).
      5. Record a deployment change -> record success.
      6. Simulate a failed rollback attempt -> record failure (fail-closed).
      7. Record a successful rollback after remediation -> record success.
      8. Durability proof: close the source engine, reopen the file with a
         fresh engine/session, and list the records from the reopened
         database.
    """
    own_temp = workdir is None
    if own_temp:
        workdir = tempfile.mkdtemp(prefix="t18_ops_")
    workdir = os.fspath(workdir)

    source_db_path = os.path.join(workdir, "source.sqlite3")
    restore_db_path = os.path.join(workdir, "restore.sqlite3")
    backup_path = os.path.join(workdir, "backup.json")

    try:
        engine = create_sqlite_engine(source_db_path)
        factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

        admin_id = _seed_admin_user(factory)

        # 1. Backup
        _take_synthetic_backup(factory, backup_path)
        backup_ok = os.path.exists(backup_path) and os.path.getsize(backup_path) > 0
        backup_record_id = _record_operation(
            factory,
            operation_type="backup",
            action="synthetic_full_backup",
            target_description="local SQLite synthetic dataset",
            outcome="success" if backup_ok else "failed",
            actor_user_id=admin_id,
            detail_summary="JSON serialization of all tables" if backup_ok else None,
            failure_summary=None if backup_ok else "backup file missing or empty",
        )

        # 2. Restore rehearsal: restore into a separate fresh database and
        #    verify a seeded persisted record from the restored database.
        restore_ok, restore_failure = perform_restore_rehearsal(
            backup_path, restore_db_path
        )
        restore_record_id = _record_operation(
            factory,
            operation_type="restore",
            action="synthetic_restore_rehearsal",
            target_description="local SQLite synthetic backup file",
            outcome="success" if restore_ok else "failed",
            actor_user_id=admin_id,
            detail_summary=(
                "backup restored into fresh database and seeded record verified"
                if restore_ok
                else None
            ),
            failure_summary=restore_failure,
        )

        # 3. Deletion propagation (SPEC-0012 R-005/AC-005; fail-closed)
        verified_id, pending_id = _simulate_deletion_propagation(
            factory, backup_path, admin_id
        )
        propagation_ok = False
        try:
            with open(backup_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            erasure_rows = {row["id"]: row for row in data.get("erasure_records", [])}
            propagation_ok = (
                erasure_rows.get(str(verified_id), {}).get("propagation_status") == "verified"
                and erasure_rows.get(str(pending_id), {}).get("propagation_status") == "pending"
            )
        except Exception:
            propagation_ok = False
        verified_propagation_id = _record_operation(
            factory,
            operation_type="deletion_propagation",
            action="synthetic_erasure_propagated_to_backup",
            target_description="local SQLite synthetic backup within bounded window",
            outcome="success" if propagation_ok else "failed",
            actor_user_id=admin_id,
            detail_summary="erasure record verified as propagated in backup copy"
            if propagation_ok
            else None,
            failure_summary=None
            if propagation_ok
            else "erasure propagation could not be verified in backup",
        )
        pending_propagation_id = _record_operation(
            factory,
            operation_type="deletion_propagation",
            action="synthetic_erasure_propagation_pending",
            target_description="local SQLite synthetic backup (propagation incomplete)",
            outcome="unverified",
            actor_user_id=admin_id,
            detail_summary="erasure propagation marked incomplete; never recorded as success",
        )

        # 4. Deployment change
        deploy_record_id = _record_operation(
            factory,
            operation_type="deployment_change",
            action="synthetic_config_update",
            target_description="local synthetic configuration (no real deployment)",
            outcome="success",
            actor_user_id=admin_id,
            detail_summary="configuration change applied and validated locally",
        )

        # 5. Failed rollback attempt (fail-closed: record as failure, not success)
        failed_rollback_id = _record_operation(
            factory,
            operation_type="rollback",
            action="synthetic_rollback_attempt",
            target_description="local synthetic deployment (simulated failure)",
            outcome="failed",
            actor_user_id=admin_id,
            failure_summary="rollback could not complete: dependency unavailable",
        )

        # 6. Successful rollback after remediation
        rollback_record_id = _record_operation(
            factory,
            operation_type="rollback",
            action="synthetic_rollback_completed",
            target_description="local synthetic deployment (after remediation)",
            outcome="success",
            actor_user_id=admin_id,
            detail_summary="rollback completed; service returned to previous known-good state",
        )

        # 7. Durability proof: close the source engine and reopen the file
        #    with a fresh engine/session before listing the records.
        engine.dispose()
        reopened_engine = create_sqlite_engine(source_db_path)
        try:
            reopened_factory = sessionmaker(
                bind=reopened_engine, expire_on_commit=False, autoflush=False
            )
            operations = _list_operations(reopened_factory)
        finally:
            reopened_engine.dispose()

        return {
            "workdir": workdir,
            "source_db_path": source_db_path,
            "restore_db_path": restore_db_path,
            "backup_path": backup_path,
            "backup_record_id": str(backup_record_id),
            "restore_record_id": str(restore_record_id),
            "verified_propagation_id": str(verified_propagation_id),
            "pending_propagation_id": str(pending_propagation_id),
            "deploy_record_id": str(deploy_record_id),
            "failed_rollback_id": str(failed_rollback_id),
            "rollback_record_id": str(rollback_record_id),
            "operations": operations,
            "passed": (
                backup_ok
                and restore_ok
                and propagation_ok
                and len(operations) == 7
                and all(
                    o["outcome"] in ("success", "failed", "unverified")
                    for o in operations
                )
                and any(
                    o["outcome"] == "failed"
                    for o in operations
                    if o["operation_type"] == "rollback"
                )
                and any(
                    o["operation_type"] == "deletion_propagation"
                    and o["outcome"] == "unverified"
                    for o in operations
                )
            ),
        }
    finally:
        if own_temp:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    print("=" * 60)
    print("TASK-0018 Local Synthetic Operations Evidence")
    print("=" * 60)
    result = run_evidence()
    print(f"  Records written: {len(result['operations'])}")
    for op in result["operations"]:
        print(f"  [{op['outcome']:>10}] {op['operation_type']:<20} {op['action']}")
    print("-" * 60)
    print("  Durability: records listed after closing and reopening the")
    print("              file-backed source database with a fresh engine")
    print("-" * 60)
    if result["passed"]:
        print("RESULT: PASSED — all operation records durable and inspectable")
    else:
        print("RESULT: FAILED — evidence sequence did not complete as expected")
    print("=" * 60)
    sys.exit(0 if result["passed"] else 1)
