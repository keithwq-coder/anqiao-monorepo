"""SPEC-0003 v0.4.0 (TASK-0040): outbound whitelist assembler.

R-016 / DEC-0158 point 3: the egress boundary is whitelist-enforced. Only the
explicitly allowed announcement fields may be assembled into an outbound
payload; every other field is dropped *at assembly time* — it is never
serialized, logged, or sent.

Allowed fields (DEC-0158 point 3):
  - announcement title
  - announcement body or abstract, ONLY when required for classification
    (``include_body=True``; otherwise dropped too)
  - source URL
  - publication timestamp
  - announcement type
  - non-sensitive technical metadata required for audit (source name,
    fetch timestamp, retention deadline)

Forbidden (DEC-0158 point 4): customer names, phone numbers, contact details,
follow-up bodies, CRM notes, raw customer evidence, credentials, and any
non-whitelisted field.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

#: The only field names that may cross the egress boundary.
OUTBOUND_ALLOWED_FIELDS: Final[frozenset[str]] = frozenset({
    # announcement content
    "title",
    "body",          # only when include_body=True (classification need)
    "abstract",      # only when include_body=True (classification need)
    # source provenance
    "source_url",
    "published_at",
    "announcement_type",
    # non-sensitive audit metadata
    "source_name",
    "fetched_at",
    "retained_until",
})

#: The only fields that require classification (body/abstract). Both are
#: dropped unless the caller explicitly opts in.
_CLASSIFICATION_ONLY_FIELDS: Final[frozenset[str]] = frozenset({"body", "abstract"})


def assemble_outbound(
    raw: Mapping[str, object],
    *,
    include_body: bool = False,
) -> dict[str, object]:
    """Return a NEW dict containing only whitelisted fields from ``raw``.

    Non-whitelisted keys are dropped silently (never echoed back to the
    caller's payload). ``body``/``abstract`` are included only when
    ``include_body=True`` (classification-only per SPEC-0003 R-016).
    """
    out: dict[str, object] = {}
    for key, value in raw.items():
        if key not in OUTBOUND_ALLOWED_FIELDS:
            continue
        if key in _CLASSIFICATION_ONLY_FIELDS and not include_body:
            continue
        out[key] = value
    return out


def outbound_field_names(payload: Mapping[str, object]) -> list[str]:
    """Field-name list for audit (R-014/AC-008): names, never values."""
    return sorted(payload.keys())


def is_allowed_field(field_name: str) -> bool:
    """True when ``field_name`` may cross the egress boundary."""
    return field_name in OUTBOUND_ALLOWED_FIELDS
