r"""TASK-0009 effectiveness check: prove the phone-leak assertion is no longer
flaky when a random CSRF token happens to contain a phone-shaped digit run.

This is a regression/mutation check, not a business-behavior test. It forces
``secrets.token_hex`` to return a token containing ``18374650291`` (matches
``1[3-9]\d{9}``) and re-runs the non-owner masking assertion. Before the fix,
this reproduced the audit's intermittent failure ~2% of the time; with the
fix it must pass deterministically.
"""
import secrets as _secrets

import pytest

# Reuse the S5 in-memory fixture so this check runs in the same harness.
from test_s5_pages_api_parity import s5_env  # noqa: F401  (fixture export)

# A 64-hex-char string containing the phone-shaped run "18374650291".
_PHONE_TOKEN = "aa18374650291bb" + "0" * (64 - 16)


@pytest.fixture
def force_phone_csrf_token(monkeypatch):
    """Make every secrets.token_hex call return a token containing a phone run."""
    def _fake_token_hex(n):
        if n <= len(_PHONE_TOKEN):
            return _PHONE_TOKEN[:n]
        return _PHONE_TOKEN + "0" * (n - len(_PHONE_TOKEN))
    monkeypatch.setattr(_secrets, "token_hex", _fake_token_hex)
    yield


def test_non_owner_masking_stable_with_phone_shaped_csrf(force_phone_csrf_token, s5_env):
    """The non-owner phone-leak assertion must not false-trigger when the CSRF
    token itself contains a phone-shaped digit run."""
    from datetime import datetime, timezone
    import re

    from test_s5_pages_api_parity import (
        _add_activity,
        _add_contact,
        _create_institution,
        _login_as,
        _phones_in_page,
    )

    client = s5_env["client"]
    inst = _create_institution(client, name="脱敏稳定性机构")
    _add_contact(client, inst["id"], name="赵六", phone="13700000000")
    _add_activity(
        client, inst["id"],
        datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
        "owner 专属正文",
        shared_summary="共享摘要",
    )
    other = _login_as("s5other", "s5other123")
    # Precondition: the forced token really matches the phone regex in isolation.
    assert re.search(r"1[3-9]\d{9}", other.headers["X-CSRF-Token"]), \
        "fixture precondition: token must be phone-shaped"
    # The page renders that token in base.html; the masked-content scan must
    # exclude it so the assertion checks business content only.
    page = other.get(f"/institutions/{inst['id']}")
    assert page.status_code == 200
    assert _phones_in_page(page.text, other) == set(), \
        "phone-shaped CSRF token leaked into phone scan"
