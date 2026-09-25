#!/usr/bin/env python3
"""Scheduled opportunity-discovery CLI entry point.

Called by ``anqiao-crm-crawl.service`` (systemd timer) every 6 hours.
Loads the same runtime environment as the web app, builds the
OpportunityService with real crawler + AI reason generators, runs discovery
for the first enabled administrator, and exits.

Fail-closed: when the crawler or AI provider is not configured, the
synthetic-stub behavior is preserved and the script still succeeds (zero
candidates is a valid outcome).  Exit code 0 = run completed (even if
degraded); exit code non-zero = infrastructure failure (DB, env, etc.).
"""

from __future__ import annotations

import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

# ---------------------------------------------------------------------------
# Bootstrap: ensure the project root is on sys.path
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_SRC = _PROJECT_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

# ---------------------------------------------------------------------------
# Load environment (same order as deploy/start.sh)
# ---------------------------------------------------------------------------
_ENV_FILES = [
    _PROJECT_ROOT / "shared" / "database.env",
    _PROJECT_ROOT / "shared" / "ai.env",
]

for _env_file in _ENV_FILES:
    if _env_file.is_file():
        with open(_env_file, encoding="utf-8") as _fh:
            for _line in _fh:
                _line = _line.strip()
                if not _line or _line.startswith("#"):
                    continue
                if "=" not in _line:
                    continue
                _key, _, _value = _line.partition("=")
                _key = _key.strip()
                _value = _value.strip().strip('"').strip("'")
                # Only export whitelisted AI keys (same as start.sh)
                if _key.startswith(("CRM_AI_REASON_", "AI_SHANGJI_", "AI_ENABLED")) or _key in (
                    "DATABASE_PASSWORD", "SESSION_SECRET_KEY",
                ):
                    os.environ.setdefault(_key, _value)
                elif _key in ("DATABASE_HOST", "DATABASE_NAME", "DATABASE_USER"):
                    os.environ.setdefault(_key, _value)

# Set defaults not in env files
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "anqiao_crm")
os.environ.setdefault("DATABASE_USER", "anqiao_crm_app")
os.environ.setdefault("PYTHONPATH", f"{_PROJECT_ROOT}/src:{os.environ.get('PYTHONPATH', '')}")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


def _main() -> int:
    _log("opportunity crawl starting")

    # ---- settings & DB ----
    from crm.config import Settings
    from crm.persistence.database import get_session_factory, SessionLocal

    settings = Settings()
    session_factory = get_session_factory(settings)

    # ---- repositories ----
    from crm.persistence.repositories import InstitutionRepository
    from crm.persistence.user_repository import UserRepository
    from crm.persistence.audit_repository import AuditEventRepository

    institution_repository = InstitutionRepository()
    user_repository = UserRepository()
    audit_repository = AuditEventRepository()

    # ---- crawler & AI reason generators (same wiring as web app) ----
    from crm.ai.wiring import build_crawler_source, build_reason_generator
    import httpx

    _reason_http_client = httpx.Client(timeout=120.0)

    crawler_source = build_crawler_source(audit_repository=audit_repository)
    reason_generator = build_reason_generator(
        audit_repository=audit_repository,
        http_client=_reason_http_client,
        timeout_seconds=120.0,
    )
    crawler_reason_generator = build_reason_generator(
        audit_repository=audit_repository,
        http_client=_reason_http_client,
        timeout_seconds=120.0,
    )

    # ---- opportunity service ----
    from crm.application.opportunity import OpportunityService

    service = OpportunityService(
        institution_repo=institution_repository,
        user_repo=user_repository,
        session_factory=session_factory,
        crawler_source=crawler_source,
        reason_generator=reason_generator,
        crawler_reason_generator=crawler_reason_generator,
    )

    # ---- find an enabled administrator to act as the trigger actor ----
    from crm.domain.models import Role, UserStatus
    from crm.persistence.models import RoleGrantModel, UserIdentityModel
    from crm.persistence.database import transaction_session
    import sqlalchemy as sa

    admin_id: UUID | None = None
    admin_name = "unknown"

    with transaction_session(session_factory) as session:
        # Find an active user who has the ADMINISTRATOR role grant
        row = session.execute(
            sa.select(UserIdentityModel.id, UserIdentityModel.display_name, UserIdentityModel.username)
            .join(RoleGrantModel, RoleGrantModel.user_id == UserIdentityModel.id)
            .where(
                RoleGrantModel.role == Role.ADMINISTRATOR.value,
                UserIdentityModel.status == UserStatus.ENABLED.value,
            )
            .limit(1)
        ).first()
        if row is not None:
            admin_id = row[0]
            admin_name = row[1] or row[2] or str(admin_id)

    if admin_id is None:
        _log("ERROR: no enabled administrator found — cannot run discovery")
        return 1

    _log(f"actor: {admin_name} ({admin_id})")

    # ---- run crawler-only discovery (SPEC-0003 v0.5.0) ----
    try:
        result = service.run_crawler(admin_id)
    except Exception:
        _log(f"ERROR: discovery run failed:\n{traceback.format_exc()}")
        return 1
    finally:
        _reason_http_client.close()

    _log(
        f"discovery complete: generated={result['generated']} "
        f"synthetic={result['synthetic']} "
        f"crawler_degraded={result.get('crawler_degraded')} "
        f"crawler_degraded_reason={result.get('crawler_degraded_reason', '')}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(_main())