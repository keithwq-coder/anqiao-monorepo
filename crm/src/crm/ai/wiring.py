"""SPEC-0003 v0.4.0 (TASK-0040): integration wiring.

TASK-0042 (`DEC-0164`, 2026-08-24): unified naming — the canonical env
strings are ``CRM_AI_REASON_*`` and the provider class is
``AiReasonProvider``. The pre-DEC-0164 names remain readable as runtime
fallbacks. Behavior is unchanged.

Turns runtime environment configuration into the two injectables the
``OpportunityService`` accepts (``reason_generator`` and ``crawler_source``),
with a fail-closed default: when the environment is missing or the network
gate is not explicitly opened, the wiring returns ``None`` so the whole chain
keeps the existing synthetic-stub behavior (existing tests unchanged).

Real network use additionally requires product-owner confirmation at
execution time (DEC-0158 point 5); this module only prepares components — it
never triggers a request by itself.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from typing import Final

from crm.ai.crawler import (
    DEFAULT_PUBLIC_SOURCES,
    Fetcher,
    PublicProcurementCrawler,
    crawler_enabled_by_env,
)
from crm.ai.provider import AiReasonProvider, ProviderResult

#: Env gates. Both default to NOT allowed: local execution never performs a
#: real provider call or a real fetch without an explicit runtime override.
ENV_AI_REASON_NETWORK_ALLOWED: Final[str] = "CRM_AI_REASON_NETWORK_ALLOWED"
ENV_CRAWLER_NETWORK_ALLOWED: Final[str] = "CRM_CRAWLER_NETWORK_ALLOWED"

_TRUTHY = {"1", "true", "yes", "on"}


def _env_flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "").strip().lower() in _TRUTHY or default


def build_reason_generator(
    *,
    base_url: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    timeout_seconds: float | None = None,
    http_client=None,
    network_allowed: bool | None = None,
    on_outbound: Callable[[str, list[str], str], None] | None = None,
    audit_repository=None,
) -> Callable[[dict], ProviderResult] | None:
    """Build the AI reason generator, or None when the provider cannot be
    configured (missing runtime env) so the synthetic stub stays.

    ``timeout_seconds`` overrides the provider default (10s) when the caller
    knows the gateway needs longer (production wires 120s); None keeps the
    provider default for tests and fail-fast paths.

    ``on_outbound`` receives ``(model_identifier, outbound_field_names,
    outcome)`` once per ATTEMPTED request with a truthful outcome (R-014).
    When ``audit_repository`` is given and ``on_outbound`` is not, the
    repository is used to persist the audited egress record (R-016).
    """
    if on_outbound is None and audit_repository is not None:
        from crm.ai.audit import record_ai_outbound

        def _default_recorder(
            model_identifier: str, field_names: list[str], outcome: str
        ) -> None:
            record_ai_outbound(
                audit_repository,
                model_identifier=model_identifier,
                outbound_field_names=field_names,
                outcome=outcome,
            )

        on_outbound = _default_recorder

    provider = AiReasonProvider(
        base_url=base_url,
        model=model,
        api_key=api_key,
        timeout_seconds=timeout_seconds,
        http_client=http_client,
        network_allowed=(
            network_allowed
            if network_allowed is not None
            else _env_flag(ENV_AI_REASON_NETWORK_ALLOWED)
        ),
        on_outbound=on_outbound,
    )
    if not provider.is_configured:
        return None
    return provider.generate_reason


def build_crawler_source(
    *,
    sources: tuple[dict[str, str], ...] = DEFAULT_PUBLIC_SOURCES,
    fetcher: Fetcher | None = None,
    network_allowed: bool | None = None,
    audit_repository=None,
) -> PublicProcurementCrawler | None:
    """Build the public-source crawler adapter, or None when the crawler is
    not enabled by the runtime environment (synthetic stub stays).

    When the runtime enables the crawler but no fetcher is injected, the
    real httpx fetcher is attached (SSRF-hardened: ``.gov.cn`` hosts only,
    hop-by-hop redirect validation, body size cap) so the enabled adapter can
    actually fetch — previously it would always degrade with "fetcher
    unavailable". Real egress still additionally requires
    ``CRM_CRAWLER_NETWORK_ALLOWED`` plus product-owner confirmation
    (DEC-0158 point 5).
    """
    if fetcher is None:
        if not crawler_enabled_by_env():
            return None
        from crm.ai.crawler import make_httpx_fetcher

        fetcher = make_httpx_fetcher()
    return PublicProcurementCrawler(
        sources=sources,
        fetcher=fetcher,
        network_allowed=(
            network_allowed
            if network_allowed is not None
            else _env_flag(ENV_CRAWLER_NETWORK_ALLOWED)
        ),
        audit_repository=audit_repository,
    )
