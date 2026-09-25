#!/usr/bin/env python
"""Fail-closed operations configuration health check (SPEC-0012 §6, §8).

TASK-0018: validates that the runtime configuration is complete and
fail-closed. This is NOT a deployment or server health check — it
inspects local configuration readiness only.

Fail-closed semantics (SPEC-0012 §8):
  - Missing required configuration -> FAIL (exit code 1)
  - A dependency that cannot be reached -> UNAVAILABLE (distinguished
    from success; never reported as healthy)
  - Only a fully validated configuration -> PASS

No secret is ever printed. The database password is checked for presence
only (never displayed). All output uses placeholder markers.

Usage:
    python scripts/check_operations_health.py

Exit codes:
    0 = PASS (configuration complete and fail-closed)
    1 = FAIL (missing or invalid configuration)
    2 = UNAVAILABLE (a dependency could not be reached)

This script touches no remote or production resources.
"""

from __future__ import annotations

import os
import sys
from typing import NamedTuple

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(project_root, "src"))


class HealthResult(NamedTuple):
    status: str  # PASS | FAIL | UNAVAILABLE
    checks: list[tuple[str, str, str]]  # (name, result, detail)


def _check_required_env() -> list[tuple[str, str, str]]:
    """Check that required non-secret environment variables are set."""
    results: list[tuple[str, str, str]] = []
    required_non_secret = [
        "DATABASE_HOST",
        "DATABASE_NAME",
        "DATABASE_USER",
    ]
    for name in required_non_secret:
        value = os.environ.get(name, "")
        if not value or not value.strip():
            results.append((name, "FAIL", "missing or blank"))
        else:
            results.append((name, "PASS", "present"))
    return results


def _check_secret_present() -> list[tuple[str, str, str]]:
    """Check that the database password is present at runtime (never display it)."""
    results: list[tuple[str, str, str]] = []
    password = os.environ.get("DATABASE_PASSWORD", "")
    if not password or not password.strip():
        results.append(("DATABASE_PASSWORD", "FAIL", "missing — must be supplied at runtime"))
    else:
        results.append(("DATABASE_PASSWORD", "PASS", "present (value hidden)"))
    return results


def _check_environment_value() -> list[tuple[str, str, str]]:
    """Check that CRM_ENVIRONMENT is a valid value."""
    results: list[tuple[str, str, str]] = []
    env = os.environ.get("CRM_ENVIRONMENT", "development")
    if env not in ("development", "test", "production"):
        results.append(("CRM_ENVIRONMENT", "FAIL", f"invalid value: {env!r}"))
    else:
        results.append(("CRM_ENVIRONMENT", "PASS", env))
    return results


def _check_ai_disabled() -> list[tuple[str, str, str]]:
    """Check that AI integration is not enabled (fail-closed per config.py)."""
    results: list[tuple[str, str, str]] = []
    ai_enabled = os.environ.get("AI_ENABLED", "false").lower()
    if ai_enabled in ("true", "1", "yes"):
        results.append(("AI_ENABLED", "FAIL", "external AI integration is not authorized"))
    else:
        results.append(("AI_ENABLED", "PASS", "disabled"))
    return results


def _check_session_secret() -> list[tuple[str, str, str]]:
    """Check that SESSION_SECRET_KEY is present at runtime."""
    results: list[tuple[str, str, str]] = []
    secret = os.environ.get("SESSION_SECRET_KEY", "")
    if not secret or not secret.strip():
        results.append(("SESSION_SECRET_KEY", "FAIL", "missing — must be supplied at runtime"))
    else:
        results.append(("SESSION_SECRET_KEY", "PASS", "present (value hidden)"))
    return results


def _check_settings_load() -> tuple[str, str]:
    """Attempt to load Settings — fail-closed if validation rejects."""
    try:
        from crm.config import Settings

        settings = Settings()
        return "PASS", f"loaded (environment={settings.crm_environment})"
    except Exception as exc:
        return "FAIL", f"Settings validation rejected: {type(exc).__name__}"


def _check_database_reachable() -> tuple[str, str]:
    """Attempt a local-only database connectivity probe.

    Returns UNAVAILABLE (not FAIL) when the database cannot be reached,
    so the caller can distinguish "config is wrong" from "dependency is
    down" (SPEC-0012 §8: distinguish unavailable dependencies from
    successful login or backup).
    """
    try:
        from crm.config import Settings
        from sqlalchemy import create_engine, text

        settings = Settings()
        engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 3},
        )
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return "PASS", "database reachable"
        finally:
            engine.dispose()
    except Exception:
        return "UNAVAILABLE", "database not reachable (dependency unavailable)"


def run_checks(*, probe_database: bool = False) -> HealthResult:
    """Run all health checks and return the aggregated result.

    When ``probe_database`` is False (default), the database connectivity
    check is skipped — the script validates configuration readiness only,
    not runtime dependency availability. This keeps the check fast and
    side-effect-free for CI and evidence collection.

    When ``probe_database`` is True, the database check runs and an
    UNAVAILABLE result is distinguished from FAIL.
    """
    checks: list[tuple[str, str, str]] = []
    checks.extend(_check_required_env())
    checks.extend(_check_secret_present())
    checks.extend(_check_environment_value())
    checks.extend(_check_ai_disabled())
    checks.extend(_check_session_secret())

    load_result, load_detail = _check_settings_load()
    checks.append(("Settings.load", load_result, load_detail))

    has_fail = any(r == "FAIL" for _, r, _ in checks)

    if probe_database and not has_fail:
        db_result, db_detail = _check_database_reachable()
        checks.append(("database.connect", db_result, db_detail))
    elif probe_database:
        checks.append(
            ("database.connect", "SKIPPED", "skipped because earlier checks failed")
        )

    if any(r == "FAIL" for _, r, _ in checks):
        status = "FAIL"
    elif any(r == "UNAVAILABLE" for _, r, _ in checks):
        status = "UNAVAILABLE"
    else:
        status = "PASS"

    return HealthResult(status=status, checks=checks)


def main() -> int:
    probe_db = "--probe-database" in sys.argv
    result = run_checks(probe_database=probe_db)

    print("=" * 60)
    print("TASK-0018 Operations Configuration Health Check")
    print("=" * 60)
    for name, check_result, detail in result.checks:
        print(f"  [{check_result:>12}] {name:<24} {detail}")
    print("-" * 60)
    print(f"RESULT: {result.status}")
    print("=" * 60)

    if result.status == "PASS":
        return 0
    if result.status == "UNAVAILABLE":
        return 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
