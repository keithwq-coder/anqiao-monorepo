"""Create the zxx agent account on production (DEC-0146).

One-shot, idempotent: skips if ``zxx`` already exists. Uses the deployed
``crm`` package for Argon2id hashing and the runtime DB settings. Never
prints the temporary password.
"""
import sys

sys.path.insert(0, "/opt/anqiao-crm/src")

from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa

from crm.config import Settings
from crm.persistence.database import build_engine, build_session_factory
from crm.web.auth import hash_password


def main() -> None:
    settings = Settings()
    engine = build_engine(settings)
    session = build_session_factory(engine)()
    now = datetime.now(timezone.utc)

    # The granter: prefer the canonical admin account.
    admin_id = session.execute(
        sa.text("SELECT id FROM user_identities WHERE username = 'admin' LIMIT 1")
    ).scalar_one_or_none()
    if admin_id is None:
        admin_id = session.execute(
            sa.text("SELECT id FROM user_identities ORDER BY id LIMIT 1")
        ).scalar_one_or_none()
    if admin_id is None:
        raise SystemExit("NO_ADMIN_FOUND")

    existing = session.execute(
        sa.text("SELECT id FROM user_identities WHERE lower(username) = 'zxx'")
    ).scalar_one_or_none()
    if existing is not None:
        print("ALREADY_EXISTS", existing)
        return

    uid = uuid4()
    password_hash = hash_password("123")

    session.execute(
        sa.text(
            "INSERT INTO user_identities "
            "(id, username, display_name, password_hash, status, session_epoch, phone, created_at, updated_at) "
            "VALUES (:id, :username, :display_name, :password_hash, :status, 0, :phone, :now, :now)"
        ),
        {
            "id": uid,
            "username": "zxx",
            "display_name": "张先侠",
            "password_hash": password_hash,
            "status": "enabled",
            "phone": "15805243456",
            "now": now,
        },
    )
    session.execute(
        sa.text(
            "INSERT INTO role_grants "
            "(id, user_id, role, scope_reference, granted_by_user_id, reason, granted_at) "
            "VALUES (:gid, :uid, 'agent', NULL, :admin, :reason, :now)"
        ),
        {
            "gid": uuid4(),
            "uid": uid,
            "admin": admin_id,
            "reason": "DEC-0146: 代理账号开通",
            "now": now,
        },
    )
    session.commit()
    print("CREATED", uid)


if __name__ == "__main__":
    main()
