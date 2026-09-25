"""Entrypoint configuration-path tests for the ``__main__`` block.

The ``python -m crm.web.main`` entrypoint previously crashed immediately:
``Settings`` declared neither ``debug_mode`` nor ``production_mode``, and
``settings.database_url[:50]`` sliced a SQLAlchemy ``URL`` object. These tests
exercise the derived flags, the redacted banner, and a real
``runpy``-executed entrypoint run (with ``uvicorn.run`` intercepted) so the
green local suite actually covers the entrypoint.
"""

import os
import pytest


def _set_db_env(monkeypatch) -> None:
    monkeypatch.setenv("CRM_ENVIRONMENT", "development")
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_NAME", "entry_test")
    monkeypatch.setenv("DATABASE_USER", "entry_user")
    monkeypatch.setenv("DATABASE_PASSWORD", "entry-super-secret-password")
    monkeypatch.setenv("SESSION_SECRET_KEY", "entry-test-secret-key-not-for-production")


def test_debug_production_mode_derivation(monkeypatch) -> None:
    """debug_mode/production_mode derive from crm_environment only."""
    from crm.config import Settings

    _set_db_env(monkeypatch)
    dev = Settings(crm_environment="development")
    assert dev.debug_mode is True and dev.production_mode is False

    prod = Settings(crm_environment="production")
    assert prod.debug_mode is False and prod.production_mode is True

    test_env = Settings(crm_environment="test")
    assert test_env.debug_mode is False and test_env.production_mode is False


def test_startup_banner_redacts_password(monkeypatch) -> None:
    """The entrypoint banner never prints the database password."""
    # Set env BEFORE importing crm.web.main: its module-level Settings()
    # construction requires DATABASE_* at import time.
    _set_db_env(monkeypatch)
    from crm.config import Settings
    from crm.web.main import _startup_banner

    settings = Settings()
    banner = _startup_banner(settings)

    assert "OK Starting Anqiao CRM Server" in banner
    assert "Debug mode:" in banner and "Production mode:" in banner
    assert "Database:" in banner
    # render_as_string(hide_password=True) masks the password
    assert "entry-super-secret-password" not in banner
    assert "***" in banner


def test_entrypoint_runs_without_crashing(monkeypatch) -> None:
    """Executing the real ``__main__`` path no longer crashes, binds loopback,
    and uses the derived debug flag for reload/logging."""
    import runpy

    _set_db_env(monkeypatch)

    captured: dict = {}
    monkeypatch.setattr(
        "uvicorn.run",
        lambda *args, **kwargs: captured.update(kwargs),
    )
    # Silence the banner during the runpy execution
    monkeypatch.setattr("builtins.print", lambda *args, **kwargs: None)

    runpy.run_module("crm.web.main", run_name="__main__")

    assert captured.get("host") == "127.0.0.1", "entrypoint must bind loopback only"
    assert captured.get("port") == 8000
    # Default crm_environment is "development" -> debug_mode True -> reload True
    assert captured.get("reload") is True
    assert captured.get("log_level") == "debug"


def test_entrypoint_binds_loopback_not_all_interfaces(monkeypatch) -> None:
    """Guard against regressing the bind back to 0.0.0.0 (DEC-0071 point 3)."""
    import re

    _set_db_env(monkeypatch)
    with open("src/crm/web/main.py", encoding="utf-8") as fh:
        source = fh.read()
    # The __main__ uvicorn.run block must not bind all interfaces.
    block = source.split('if __name__ == "__main__":', 1)[1]
    assert 'host="0.0.0.0"' not in block
    assert re.search(r'host="127\.0\.0\.1"', block) is not None
