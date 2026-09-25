from importlib import import_module

import pytest


@pytest.mark.parametrize(
    "module_name",
    [
        "crm.domain",
        "crm.application",
        "crm.policy",
        "crm.persistence",
        "crm.web",
        "crm.ai",
    ],
)
def test_architecture_module_is_importable(module_name: str) -> None:
    assert import_module(module_name).__name__ == module_name


def test_ai_boundary_is_explicitly_disabled() -> None:
    ai = import_module("crm.ai")

    assert ai.AI_ENABLED is False
    assert ai.is_enabled() is False
