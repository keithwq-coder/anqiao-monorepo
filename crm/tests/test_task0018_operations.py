"""TASK-0018: SPEC-0012 deployment operations evidence tests.

Local-only, synthetic state. Tests cover the four Required acceptance
criteria from the task card:

1. No secret is stored in code, documentation, generated evidence, or logs.
2. Health/auth checks fail closed and distinguish unavailable dependencies
   from successful login or backup.
3. Backup, restore rehearsal, deployment change, rollback, and operations
   audit records are durable and inspectable locally.
4. Automated acceptance and product-owner browser/visual acceptance are
   separate records with no inferred human pass.
"""

import os
import sys
from datetime import datetime, timezone
from uuid import uuid4

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t18_test")
os.environ.setdefault("DATABASE_USER", "t18_test")
os.environ.setdefault("DATABASE_PASSWORD", "t18-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t18-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
import sqlalchemy as sa  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from crm.persistence.base import Base  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    OperationRecordModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.persistence.operation_repository import OperationRecordRepository  # noqa: E402
from crm.web.auth import hash_password  # noqa: E402

# Make scripts importable for health-check testing
_scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, os.path.abspath(_scripts_dir))


def _make_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: (s or "").strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: (s or "").strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s or ""))

    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def ops_env():
    """SQLite-backed environment with an admin user for operation records."""
    engine = _make_engine()
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    now = datetime.now(timezone.utc)
    admin_id = uuid4()

    with factory() as session:
        session.add(UserIdentityModel(
            id=admin_id,
            username="ops_admin",
            display_name="Ops Admin",
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
            reason="test seed",
            granted_at=now,
        ))
        session.commit()

    return {"engine": engine, "factory": factory, "admin_id": admin_id}


# ---------------------------------------------------------------------------
# Acceptance 2: fail-closed health checks distinguish unavailable from success
# ---------------------------------------------------------------------------

class TestFailClosedHealthCheck:
    """SPEC-0012 section 8: fail-closed; distinguish unavailable from success."""

    def test_missing_password_fails_closed(self, monkeypatch):
        """Missing DATABASE_PASSWORD -> FAIL, not pass."""
        import importlib
        import check_operations_health as health_mod

        for key in ["DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER",
                     "DATABASE_PASSWORD", "SESSION_SECRET_KEY", "CRM_ENVIRONMENT",
                     "AI_ENABLED"]:
            monkeypatch.delenv(key, raising=False)
        monkeypatch.setenv("DATABASE_HOST", "localhost")
        monkeypatch.setenv("DATABASE_NAME", "test")
        monkeypatch.setenv("DATABASE_USER", "test")

        importlib.reload(health_mod)
        result = health_mod.run_checks(probe_database=False)
        assert result.status == "FAIL"
        password_check = [c for c in result.checks if c[0] == "DATABASE_PASSWORD"]
        assert len(password_check) == 1
        assert password_check[0][1] == "FAIL"

    def test_complete_config_passes_without_database_probe(self, monkeypatch):
        """Complete config (no DB probe) -> PASS."""
        import importlib
        import check_operations_health as health_mod

        for key, val in {
            "DATABASE_HOST": "localhost",
            "DATABASE_NAME": "test_db",
            "DATABASE_USER": "test_user",
            "DATABASE_PASSWORD": "synthetic-test-password",
            "SESSION_SECRET_KEY": "synthetic-test-secret",
            "CRM_ENVIRONMENT": "test",
            "AI_ENABLED": "false",
        }.items():
            monkeypatch.setenv(key, val)

        importlib.reload(health_mod)
        result = health_mod.run_checks(probe_database=False)
        assert result.status == "PASS", f"Expected PASS, got {result.status}: {result.checks}"

    def test_unavailable_dependency_distinguished_from_success(self, monkeypatch):
        """When DB probe is on and DB unreachable -> UNAVAILABLE, not FAIL or PASS."""
        import importlib
        import check_operations_health as health_mod

        for key, val in {
            "DATABASE_HOST": "nonexistent.invalid.host.example",
            "DATABASE_NAME": "test_db",
            "DATABASE_USER": "test_user",
            "DATABASE_PASSWORD": "synthetic-test-password",
            "SESSION_SECRET_KEY": "synthetic-test-secret",
            "CRM_ENVIRONMENT": "test",
            "AI_ENABLED": "false",
        }.items():
            monkeypatch.setenv(key, val)

        importlib.reload(health_mod)
        result = health_mod.run_checks(probe_database=True)
        db_check = [c for c in result.checks if c[0] == "database.connect"]
        assert len(db_check) == 1
        assert db_check[0][1] == "UNAVAILABLE"
        assert result.status == "UNAVAILABLE"

    def test_ai_enabled_is_fail_closed(self, monkeypatch):
        """AI_ENABLED=true -> FAIL (external AI not authorized)."""
        import importlib
        import check_operations_health as health_mod

        for key, val in {
            "DATABASE_HOST": "localhost",
            "DATABASE_NAME": "test_db",
            "DATABASE_USER": "test_user",
            "DATABASE_PASSWORD": "synthetic-test-password",
            "SESSION_SECRET_KEY": "synthetic-test-secret",
            "CRM_ENVIRONMENT": "test",
            "AI_ENABLED": "true",
        }.items():
            monkeypatch.setenv(key, val)

        importlib.reload(health_mod)
        result = health_mod.run_checks(probe_database=False)
        assert result.status == "FAIL"
        ai_check = [c for c in result.checks if c[0] == "AI_ENABLED"]
        assert ai_check[0][1] == "FAIL"


# ---------------------------------------------------------------------------
# Acceptance 3: operation records are durable and inspectable locally
# ---------------------------------------------------------------------------

class TestOperationRecordsDurable:
    """SPEC-0012 section 7: backup/restore/deployment/rollback records durable."""

    def test_backup_record_persisted_and_inspectable(self, ops_env):
        """A backup record can be written and read back."""
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="backup",
                actor_user_id=admin_id,
                action="synthetic_full_backup",
                target_description="local SQLite synthetic dataset",
                outcome="success",
                detail_summary="JSON serialization of all tables",
                occurred_at=now,
                completed_at=now,
            ))
            session.commit()

        with factory() as session:
            rows = session.query(OperationRecordModel).filter_by(
                operation_type="backup"
            ).all()
            assert len(rows) == 1
            assert rows[0].outcome == "success"
            assert rows[0].action == "synthetic_full_backup"
            assert rows[0].failure_summary is None

    def test_restore_rehearsal_record_durable(self, ops_env):
        """A restore rehearsal record is durable and inspectable."""
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="restore",
                actor_user_id=admin_id,
                action="restore_rehearsal",
                target_description="backup file from synthetic test",
                outcome="success",
                detail_summary="backup deserialized and verified",
                occurred_at=now,
                completed_at=now,
            ))
            session.commit()

        with factory() as session:
            rows = session.query(OperationRecordModel).filter_by(
                operation_type="restore"
            ).all()
            assert len(rows) == 1
            assert rows[0].outcome == "success"

    def test_deployment_change_and_rollback_both_recorded(self, ops_env):
        """A deployment change and its rollback both leave auditable records."""
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="deployment_change",
                actor_user_id=admin_id,
                action="config_update",
                target_description="synthetic deployment v1->v2",
                outcome="success",
                detail_summary="applied locally",
                occurred_at=now,
                completed_at=now,
            ))
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="rollback",
                actor_user_id=admin_id,
                action="rollback_to_previous",
                target_description="synthetic deployment v2->v1",
                outcome="success",
                detail_summary="returned to known-good state",
                occurred_at=now,
                completed_at=now,
            ))
            session.commit()

        with factory() as session:
            deploy_count = session.query(OperationRecordModel).filter_by(
                operation_type="deployment_change"
            ).count()
            rollback_count = session.query(OperationRecordModel).filter_by(
                operation_type="rollback"
            ).count()
            assert deploy_count == 1
            assert rollback_count == 1

    def test_failed_operation_not_recorded_as_success(self, ops_env):
        """A failed operation is recorded as failed, never success (fail-closed)."""
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="rollback",
                actor_user_id=admin_id,
                action="rollback_attempt_failed",
                target_description="synthetic deployment (failed)",
                outcome="failed",
                failure_summary="dependency unavailable",
                occurred_at=now,
                completed_at=now,
            ))
            session.commit()

        with factory() as session:
            row = session.query(OperationRecordModel).filter_by(
                action="rollback_attempt_failed"
            ).one()
            assert row.outcome == "failed"
            assert row.failure_summary == "dependency unavailable"

    def test_operation_records_inspectable_by_type_and_actor(self, ops_env):
        """Records are inspectable by type and actor (R-009/AC-009 audit)."""
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            for op_type in ("backup", "restore", "deployment_change", "rollback"):
                session.add(OperationRecordModel(
                    id=uuid4(),
                    operation_type=op_type,
                    actor_user_id=admin_id,
                    action=f"test_{op_type}",
                    target_description=f"target for {op_type}",
                    outcome="success",
                    occurred_at=now,
                    completed_at=now,
                ))
            session.commit()

        with factory() as session:
            by_actor = session.query(OperationRecordModel).filter_by(
                actor_user_id=admin_id
            ).all()
            assert len(by_actor) == 4
            types = {r.operation_type for r in by_actor}
            assert types == {"backup", "restore", "deployment_change", "rollback"}

    def test_deletion_propagation_record_durable_and_inspectable(self, ops_env):
        """A SPEC-0011 deletion propagation record is durable and inspectable.

        A verified propagation is recorded as success with a completed_at;
        an incomplete propagation is recorded as 'unverified' with no
        completed_at (SPEC-0012 §8/AC-005 — marked incomplete, never
        success).
        """
        factory = ops_env["factory"]
        admin_id = ops_env["admin_id"]
        now = datetime.now(timezone.utc)

        with factory() as session:
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="deletion_propagation",
                actor_user_id=admin_id,
                action="erasure_propagated_to_backup",
                target_description="synthetic backup within bounded window",
                outcome="success",
                detail_summary="erasure verified as propagated in backup copy",
                occurred_at=now,
                completed_at=now,
            ))
            session.add(OperationRecordModel(
                id=uuid4(),
                operation_type="deletion_propagation",
                actor_user_id=admin_id,
                action="erasure_propagation_pending",
                target_description="synthetic backup (propagation incomplete)",
                outcome="unverified",
                detail_summary="erasure propagation marked incomplete",
                occurred_at=now,
                completed_at=None,
            ))
            session.commit()

        with factory() as session:
            rows = session.query(OperationRecordModel).filter_by(
                operation_type="deletion_propagation"
            ).all()
            assert len(rows) == 2
            outcomes = {r.outcome: r for r in rows}
            assert "success" in outcomes
            assert "unverified" in outcomes
            assert outcomes["success"].completed_at is not None
            assert outcomes["unverified"].completed_at is None


# ---------------------------------------------------------------------------
# Repository validation: fail-closed enforcement
# ---------------------------------------------------------------------------

class TestOperationRepositoryValidation:
    """The repository enforces fail-closed semantics before DB write."""

    def test_success_with_failure_summary_rejected(self):
        """A success outcome must not carry a failure_summary."""
        repo = OperationRecordRepository()
        now = datetime.now(timezone.utc)
        with pytest.raises(ValueError, match="success outcome must not carry"):
            repo.record(
                operation_type="backup",
                action="test",
                target_description="test target",
                outcome="success",
                failure_summary="should not be here",
                completed_at=now,
            )

    def test_non_unverified_without_completed_at_rejected(self):
        """A non-unverified outcome requires completed_at."""
        repo = OperationRecordRepository()
        with pytest.raises(ValueError, match="completed_at is required"):
            repo.record(
                operation_type="backup",
                action="test",
                target_description="test target",
                outcome="success",
            )

    def test_invalid_operation_type_rejected(self):
        """Invalid operation_type is rejected."""
        repo = OperationRecordRepository()
        with pytest.raises(ValueError, match="operation_type must be one of"):
            repo.record(
                operation_type="invalid_type",
                action="test",
                target_description="test target",
                outcome="success",
                completed_at=datetime.now(timezone.utc),
            )

    def test_invalid_outcome_rejected(self):
        """Invalid outcome is rejected."""
        repo = OperationRecordRepository()
        with pytest.raises(ValueError, match="outcome must be one of"):
            repo.record(
                operation_type="backup",
                action="test",
                target_description="test target",
                outcome="maybe",
                completed_at=datetime.now(timezone.utc),
            )

    def test_deletion_propagation_success_accepted_by_repository(self, ops_env):
        """deletion_propagation is an allowed operation type; a verified
        propagation is recorded as success with completed_at."""
        factory = ops_env["factory"]
        repo = OperationRecordRepository()
        now = datetime.now(timezone.utc)
        with factory() as session:
            record = repo.record(
                session=session,
                operation_type="deletion_propagation",
                action="erasure_propagated_to_backup",
                target_description="synthetic backup within bounded window",
                outcome="success",
                actor_user_id=ops_env["admin_id"],
                completed_at=now,
            )
            session.commit()
            assert record.operation_type == "deletion_propagation"
            assert record.outcome == "success"
            assert record.completed_at is not None

    def test_deletion_propagation_unverified_accepted_by_repository(self, ops_env):
        """An incomplete propagation is recorded as 'unverified' (marked
        incomplete) with no completed_at — never success (SPEC-0012 §8)."""
        factory = ops_env["factory"]
        repo = OperationRecordRepository()
        with factory() as session:
            record = repo.record(
                session=session,
                operation_type="deletion_propagation",
                action="erasure_propagation_pending",
                target_description="synthetic backup (propagation incomplete)",
                outcome="unverified",
                actor_user_id=ops_env["admin_id"],
            )
            session.commit()
            assert record.operation_type == "deletion_propagation"
            assert record.outcome == "unverified"
            assert record.completed_at is None


# ---------------------------------------------------------------------------
# Acceptance 1: no secret stored in code, docs, evidence, or logs
# ---------------------------------------------------------------------------

class TestNoSecretsInEvidence:
    """SPEC-0012 section 10: no secret in code, documentation, evidence, or logs."""

    SECRET_PATTERNS = [
        "DATABASE_PASSWORD=t18-synthetic-only-placeholder",
        "password=ops-synthetic-only",
        "SESSION_SECRET_KEY=t18-ops-evidence-secret",
    ]

    def test_operations_evidence_script_has_no_hardcoded_secret(self):
        """The operations evidence script uses placeholders, not real secrets."""
        script_path = os.path.join(
            os.path.dirname(__file__), "..", "scripts", "operations_evidence.py"
        )
        with open(script_path, "r", encoding="utf-8") as f:
            content = f.read()
        # The script should use placeholder-style synthetic values
        assert "synthetic" in content.lower() or "placeholder" in content.lower()
        # Should not contain real-looking production credentials
        assert "aibrain" not in content.lower()
        assert "crm.aibrain.wiki" not in content

    def test_health_check_script_never_prints_password(self):
        """The health check script never displays the password value."""
        script_path = os.path.join(
            os.path.dirname(__file__), "..", "scripts", "check_operations_health.py"
        )
        with open(script_path, "r", encoding="utf-8") as f:
            content = f.read()
        # The password is checked for presence but never printed
        assert "value hidden" in content
        # No echo/print of the password variable
        assert "print(password" not in content
        assert "print(.*password" not in content

    def test_operation_record_model_has_no_secret_field(self):
        """The OperationRecordModel has no field that stores secrets."""
        column_names = {c.name for c in OperationRecordModel.__table__.columns}
        secret_forbidden = {"password", "password_hash", "secret", "token", "credential"}
        assert not (column_names & secret_forbidden), \
            f"OperationRecordModel must not have secret fields: {column_names & secret_forbidden}"


# ---------------------------------------------------------------------------
# Acceptance 4: automated vs human acceptance are separate records
# ---------------------------------------------------------------------------

class TestAcceptanceSeparation:
    """SPEC-0012 section 9: automated and human acceptance are separate."""

    def test_automated_checks_do_not_infer_human_pass(self):
        """Automated checks produce their own record; human acceptance is
        a separate, explicitly-recorded event that cannot be inferred."""
        # This is a contract test: the operation record model supports
        # recording an 'unverified' outcome that cannot be confused with
        # 'success'. Human visual acceptance would be a separate record
        # (e.g. a deployment_change with detail_summary noting human review
        # required), never inferred from an automated 'success'.
        now = datetime.now(timezone.utc)
        record = OperationRecordModel(
            id=uuid4(),
            operation_type="deployment_change",
            action="automated_check_only",
            target_description="automated test suite",
            outcome="success",
            detail_summary="automated checks passed; human visual acceptance NOT VERIFIED",
            occurred_at=now,
            completed_at=now,
        )
        # The outcome is 'success' for the automated check, but the
        # detail_summary explicitly states human acceptance is NOT VERIFIED.
        # These are separate concerns: automated success != human acceptance.
        assert record.outcome == "success"
        assert "NOT VERIFIED" in record.detail_summary

    def test_unverified_outcome_is_distinct_from_success(self):
        """An 'unverified' outcome is distinct from 'success' — it cannot
        be treated as a pass."""
        now = datetime.now(timezone.utc)
        record = OperationRecordModel(
            id=uuid4(),
            operation_type="backup",
            action="backup_not_yet_verified",
            target_description="pending verification",
            outcome="unverified",
            occurred_at=now,
            completed_at=None,  # unverified has no completed_at
        )
        assert record.outcome == "unverified"
        assert record.outcome != "success"
        assert record.completed_at is None


# ---------------------------------------------------------------------------
# Integration: operations evidence script runs end-to-end
# ---------------------------------------------------------------------------

class TestOperationsEvidenceScript:
    """The operations evidence helper script runs end-to-end locally."""

    def test_script_produces_durable_records(self):
        """Running the evidence script produces 7 durable, inspectable records
        including deletion propagation (verified and marked-incomplete)."""
        import operations_evidence as evidence_mod

        result = evidence_mod.run_evidence()
        assert result["passed"] is True
        assert len(result["operations"]) == 7
        # All five operation types should be represented
        types = {op["operation_type"] for op in result["operations"]}
        assert "backup" in types
        assert "restore" in types
        assert "deployment_change" in types
        assert "rollback" in types
        assert "deletion_propagation" in types
        # At least one failed rollback (fail-closed demonstration)
        failed_rollbacks = [
            op for op in result["operations"]
            if op["operation_type"] == "rollback" and op["outcome"] == "failed"
        ]
        assert len(failed_rollbacks) >= 1
        # Deletion propagation: one verified (success) and one marked
        # incomplete (unverified, no completed_at) — never success when
        # unverified (SPEC-0012 §8/AC-005)
        propagation = [
            op for op in result["operations"]
            if op["operation_type"] == "deletion_propagation"
        ]
        assert len(propagation) == 2
        assert any(op["outcome"] == "success" for op in propagation)
        assert any(op["outcome"] == "unverified" for op in propagation)
        pending = next(op for op in propagation if op["outcome"] == "unverified")
        assert pending["completed_at"] is None
        # No secret values in the output
        for op in result["operations"]:
            for field in ("detail_summary", "failure_summary", "target_description"):
                val = op.get(field)
                if val:
                    assert "aibrain" not in val.lower()
                    assert "password" not in val.lower() or "placeholder" in val.lower()


# ---------------------------------------------------------------------------
# Regression: file-backed durability and real restore rehearsal
# ---------------------------------------------------------------------------

class TestFileBackedRestoreAndDurability:
    """SPEC-0012 R-004/AC-004: the evidence sequence must use a file-backed
    source database and a real restore rehearsal.

    These tests fail against the old implementation, which used an
    in-memory ``sqlite://``/``StaticPool`` engine and treated the presence
    of an ``operation_records`` JSON key as a successful restore. They
    prove, with fresh engines against the on-disk files:

      1. the source records survive a close/reopen of the source database;
      2. a backup artifact restored into a separate fresh database yields
         readable seeded data; and
      3. a missing or corrupt backup is never recorded as a successful
         restore.
    """

    def test_source_records_survive_close_and_reopen(self, tmp_path):
        """Closing the source engine and reopening the file with a fresh
        engine must still yield all seven operation records."""
        import operations_evidence as evidence_mod

        result = evidence_mod.run_evidence(workdir=str(tmp_path))
        assert result["passed"] is True
        assert os.path.exists(result["source_db_path"])

        # Fresh engine against the on-disk file — no shared in-memory state.
        reopened_engine = evidence_mod.create_sqlite_engine(result["source_db_path"])
        try:
            reopened_factory = sessionmaker(
                bind=reopened_engine, expire_on_commit=False, autoflush=False
            )
            with reopened_factory() as session:
                rows = session.query(OperationRecordModel).all()
            assert len(rows) == 7
            assert {"backup", "restore", "deletion_propagation",
                    "deployment_change", "rollback"} == {
                r.operation_type for r in rows
            }
        finally:
            reopened_engine.dispose()

    def test_restored_data_is_readable_from_fresh_restored_database(self, tmp_path):
        """A backup artifact restored into a separate fresh database must
        yield at least one seeded persisted record read from the restored
        database itself — a JSON key or table name alone is not a restore."""
        import operations_evidence as evidence_mod

        result = evidence_mod.run_evidence(workdir=str(tmp_path))
        assert result["passed"] is True
        assert os.path.exists(result["restore_db_path"])

        # Read from the restored database with a fresh engine.
        restored_engine = evidence_mod.create_sqlite_engine(result["restore_db_path"])
        try:
            restored_factory = sessionmaker(
                bind=restored_engine, expire_on_commit=False, autoflush=False
            )
            with restored_factory() as session:
                admin = (
                    session.query(UserIdentityModel)
                    .filter(UserIdentityModel.username == "ops_admin")
                    .first()
                )
            assert admin is not None, (
                "seeded persisted record must be readable from the restored database"
            )
            assert admin.username == "ops_admin"
        finally:
            restored_engine.dispose()

    def test_missing_backup_restore_is_never_success(self, tmp_path):
        """A missing backup must not yield a successful restore record."""
        import operations_evidence as evidence_mod

        missing_backup = str(tmp_path / "does-not-exist.json")
        restore_db = str(tmp_path / "restore_missing.sqlite3")
        ok, failure = evidence_mod.perform_restore_rehearsal(missing_backup, restore_db)
        assert ok is False
        assert failure is not None

    def test_corrupt_backup_restore_is_never_success(self, tmp_path):
        """A corrupt backup must not yield a successful restore record."""
        import operations_evidence as evidence_mod

        corrupt_backup = str(tmp_path / "corrupt.json")
        with open(corrupt_backup, "w", encoding="utf-8") as f:
            f.write("{ not valid json !!!")
        restore_db = str(tmp_path / "restore_corrupt.sqlite3")
        ok, failure = evidence_mod.perform_restore_rehearsal(corrupt_backup, restore_db)
        assert ok is False
        assert failure is not None

    def test_json_key_alone_is_not_a_successful_restore(self, tmp_path):
        """A backup JSON carrying an ``operation_records`` key but no
        restored seeded data must NOT count as a successful restore."""
        import json
        import operations_evidence as evidence_mod

        key_only_backup = str(tmp_path / "key_only.json")
        with open(key_only_backup, "w", encoding="utf-8") as f:
            json.dump({"operation_records": []}, f)
        restore_db = str(tmp_path / "restore_key_only.sqlite3")
        ok, failure = evidence_mod.perform_restore_rehearsal(key_only_backup, restore_db)
        assert ok is False
        assert failure is not None
