"""SPEC-0003 v0.4.0 (TASK-0040): audited egress records.

R-014/AC-008: every outbound AI-reason use records the model identifier and
the outbound field-name list (names, NOT values). The audit record must never
contain protected values, API keys, or the full outbound payload.

This module is the single audited-egress recorder (R-016): provider and
crawler paths both route their audit metadata through the recorders below,
which persist an ``audit_events`` row with only non-sensitive metadata.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import UUID

from crm.ai.provider import AUDIT_ACTION_AI_OUTBOUND

#: Crawler ingestion audit action (no AI egress, source provenance only).
AUDIT_ACTION_CRAWLER_FETCH: str = "opportunity.crawler.fetch"


def record_ai_outbound(
    audit_repository,
    *,
    model_identifier: str,
    outbound_field_names: Sequence[str],
    outcome: str,
    actor_user_id: UUID | None = None,
    target_id: UUID | None = None,
    failure_summary: str | None = None,
) -> None:
    """Persist one AI-egress audit record (model id + field names only).

    The audit row carries a compact JSON summary containing the model
    identifier and the outbound field-name list. Values, keys, and payloads
    are never stored. ``outcome`` is REQUIRED and reflects the actual attempt
    result (success/failure/denied) — callers must pass the truthful value
    (R-014). There is deliberately NO "success" default: a degraded or failed
    call can never produce a success audit by omission.
    """
    audit_repository.record(
        action=AUDIT_ACTION_AI_OUTBOUND,
        outcome=outcome,
        target_type="opportunity_candidate",
        actor_user_id=actor_user_id,
        target_id=target_id,
        reason=json.dumps(
            {
                "model_identifier": model_identifier,
                "outbound_field_names": sorted(outbound_field_names),
            },
            ensure_ascii=False,
        ),
        failure_summary=failure_summary,
    )


def record_crawler_fetch(
    audit_repository,
    *,
    source_name: str,
    degraded: bool,
    outcome: str,
    degraded_reason: str = "",
) -> None:
    """Persist one crawler-ingestion audit record (source provenance only).

    ``outcome`` is REQUIRED (success/failure) — no unsafe default, so a
    degraded fetch can never be recorded as success by omission.
    """
    audit_repository.record(
        action=AUDIT_ACTION_CRAWLER_FETCH,
        outcome=outcome,
        target_type="opportunity_crawler_source",
        target_id=None,
        reason=json.dumps(
            {"source_name": source_name, "degraded": degraded},
            ensure_ascii=False,
        ),
        failure_summary=degraded_reason or None,
    )
