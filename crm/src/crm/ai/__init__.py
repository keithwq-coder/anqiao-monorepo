"""Disabled provider-neutral AI boundary for TASK-0001."""

from typing import Final

AI_ENABLED: Final[bool] = False


def is_enabled() -> bool:
    """Return the immutable AI availability state for this task."""
    return AI_ENABLED

