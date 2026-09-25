"""SPEC-0003 v0.4.0 (TASK-0040): AiReason provider adapter.

TASK-0042 (`DEC-0164`, 2026-08-24): unified naming — the canonical env
strings are ``CRM_AI_REASON_*`` and the public class is
``AiReasonProvider``. The pre-DEC-0164 ``AI_SHANGJI_*`` env strings remain
readable as runtime fallbacks so the currently-deployed service contract
is not broken; the legacy fallback is scheduled for removal on the next env
rotation. Behavior is unchanged (env-configured, fail-closed, leak-scanned,
deterministic fallback).

DEC-0158 point 1: endpoint/model/API key are read ONLY from runtime
environment variables at construction time. Credentials are never stored in
the repository, evidence, logs, or audit records, and never echoed back.

Fail-closed defaults:
  - ``network_allowed`` defaults to False. Even when the environment is fully
    configured, the adapter does NOT make a real request unless explicitly
    allowed. Local verification always injects a fake HTTP client.
  - When configuration is missing, ``generate_reason`` degrades to a local
    deterministic result and never calls the network.

Egress boundary (R-016): outbound payloads are assembled through
``crm.ai.whitelist.assemble_outbound``; the audit callback receives the model
identifier and the outbound FIELD-NAME list only (R-014/AC-008) — never keys,
values, or full payloads.
"""

from __future__ import annotations

import dataclasses
import json
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Final

from crm.ai.whitelist import assemble_outbound, outbound_field_names

ENV_BASE_URL: Final[str] = "CRM_AI_REASON_BASE_URL"
ENV_MODEL: Final[str] = "CRM_AI_REASON_MODEL"
ENV_API_KEY: Final[str] = "CRM_AI_REASON_API_KEY"
#: Legacy variable name observed on the local runtime; read as a fallback
#: when ``CRM_AI_REASON_API_KEY`` is unset. Value is never printed or
#: recorded.
ENV_LEGACY_API_KEY: Final[str] = "CRM_AI_REASON_WIRE_API"
#: Legacy env-string names kept as runtime fallbacks (pre-`DEC-0164`,
#: scheduled for removal once the production runtime is rotated to the new
#: ``CRM_AI_REASON_*`` names).
LEGACY_ENV_BASE_URL: Final[str] = "AI_SHANGJI_BASE_URL"
LEGACY_ENV_MODEL: Final[str] = "AI_SHANGJI_MODEL"
LEGACY_ENV_API_KEY: Final[str] = "AI_SHANGJI_API_KEY"
LEGACY_ENV_WIRE_API: Final[str] = "AI_SHANGJI_WIRE_API"

MAX_RESPONSE_CHARS: Final[int] = 64_000
DEFAULT_TIMEOUT_SECONDS: Final[float] = 10.0

#: Audit action used when the egress path is exercised (R-014).
AUDIT_ACTION_AI_OUTBOUND: Final[str] = "opportunity.ai_reason.outbound"


class ProviderError(Exception):
    """Base class for provider failures that must degrade, never raise UI."""


class ProviderNotConfiguredError(ProviderError):
    """Configuration is incomplete; no request may be attempted."""


class ProviderTimeoutError(ProviderError):
    """The provider request timed out."""


class ProviderMalformedResponseError(ProviderError):
    """The provider response was malformed, oversized, or non-JSON."""


class ProviderRequestError(ProviderError):
    """The provider returned a non-success status or a transport error."""


@dataclass(frozen=True)
class ProviderResult:
    """A reason-generation outcome; ``degraded=True`` means local fallback.

    ``outbound_field_names`` carries the exact field-name list that crossed
    the boundary (for audit, R-014). ``degraded_reason`` is a local
    deterministic explanation, never fabricated model text.
    """

    text: str = ""
    model_identifier: str = ""
    outbound_field_names: list[str] = field(default_factory=list)
    degraded: bool = False
    degraded_reason: str = ""


#: HTTP client contract: anything with ``post(url, json=..., headers=...,
#: timeout=...)`` returning an object with ``status_code`` and
#: ``text``/``json()`` (httpx.Client and the test fake both satisfy it).
HttpClient = object


def _read_runtime_config() -> tuple[str, str, str]:
    """Read endpoint/model/key from runtime env vars (never printed).

    Per ``DEC-0164`` (TASK-0042): the canonical env names are the
    ``CRM_AI_REASON_*`` strings defined above. The pre-rename
    ``AI_SHANGJI_*`` strings remain readable as fallbacks so the currently
    deployed service contract (TASK-0041 P2) is not broken; the legacy
    fallback is scheduled for removal on the next env rotation.
    """
    base_url = (
        os.environ.get(ENV_BASE_URL, "").strip()
        or os.environ.get(LEGACY_ENV_BASE_URL, "").strip()
    )
    model = (
        os.environ.get(ENV_MODEL, "").strip()
        or os.environ.get(LEGACY_ENV_MODEL, "").strip()
    )
    api_key = (
        os.environ.get(ENV_API_KEY, "")
        or os.environ.get(LEGACY_ENV_API_KEY, "")
        or os.environ.get(ENV_LEGACY_API_KEY, "")
        or os.environ.get(LEGACY_ENV_WIRE_API, "")
    )
    return base_url, model, api_key.strip()


class AiReasonProvider:
    """AI-reason generation adapter (env-configured, fail-closed).

    Canonical env strings are ``CRM_AI_REASON_*`` per TASK-0042 (DEC-0164);
    the pre-DEC-0164 ``AI_SHANGJI_*`` strings remain readable as runtime
    fallbacks. Behavior is unchanged; only the public class name and the
    canonical env-string constants were unified.
    """

    def __init__(
        self,
        *,
        base_url: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        http_client: HttpClient | None = None,
        network_allowed: bool = False,
        on_outbound: Callable[[str, list[str], str], None] | None = None,
    ) -> None:
        """Values fall back to runtime environment variables when not given
        explicitly. Explicit arguments win (used by tests).

        ``on_outbound(model_identifier, outbound_field_names, outcome)`` is
        invoked once per ATTEMPTED request with a truthful outcome
        (success/failure) — after the attempt resolves, so a failed egress
        is never audited as success (R-014)."""
        env_base_url, env_model, env_api_key = _read_runtime_config()
        self._base_url = base_url if base_url is not None else env_base_url
        self._model = model if model is not None else env_model
        # The key stays in this instance only; never logged/recorded/echoed.
        self._api_key = api_key if api_key is not None else env_api_key
        self._timeout_seconds = timeout_seconds
        self._http_client = http_client
        self._network_allowed = network_allowed
        self._on_outbound = on_outbound

    # ----- configuration state -----

    @property
    def is_configured(self) -> bool:
        """True only when endpoint + model + key are all present."""
        return bool(self._base_url and self._model and self._api_key)

    @property
    def model_identifier(self) -> str:
        """Model identifier for audit; never a secret."""
        return self._model or "unconfigured"

    @property
    def network_allowed(self) -> bool:
        return self._network_allowed

    # ----- egress path -----

    def generate_reason(
        self,
        announcement: Mapping[str, object],
        *,
        include_body: bool = False,
    ) -> ProviderResult:
        """Build the whitelist payload and request a reason from the provider.

        Fail-closed behavior:
          - not configured -> ``ProviderResult(degraded=True)``, no call;
          - network not allowed -> degraded, no call;
          - timeout -> ``ProviderTimeoutError`` (degraded by caller);
          - malformed/oversized/non-JSON -> ``ProviderMalformedResponseError``;
          - non-success status -> ``ProviderRequestError``.
        """
        if not self.is_configured:
            return ProviderResult(
                model_identifier=self.model_identifier,
                degraded=True,
                degraded_reason="provider not configured (runtime env missing)",
            )
        if not self._network_allowed:
            return ProviderResult(
                model_identifier=self.model_identifier,
                degraded=True,
                degraded_reason="provider egress not allowed (fail-closed default)",
            )

        payload = assemble_outbound(_as_mapping(announcement), include_body=include_body)
        field_names = outbound_field_names(payload)

        if self._http_client is None:
            # Defensive: no transport available -> degrade, never invent text.
            # No outbound attempt happened, so no outbound audit is written.
            return ProviderResult(
                model_identifier=self.model_identifier,
                outbound_field_names=field_names,
                degraded=True,
                degraded_reason="provider transport unavailable",
            )

        try:
            response = self._http_client.post(
                self._base_url,
                json={
                    "model": self._model,
                    "messages": [
                        {
                            "role": "user",
                            "content": json.dumps(payload, ensure_ascii=False, default=_json_default),
                        }
                    ],
                    "temperature": 0.2,
                    # TASK-0041 P1 fix (DEC-0162 + DEC-0163): force the
                    # approved gateway to return a single non-streamed JSON
                    # body. Empirical probe 2026-08-24: without stream=false
                    # the gateway emits SSE (data: ... chunks) and our
                    # downstream json.loads(response.text) then raises
                    # ProviderMalformedResponseError; with stream=false the
                    # gateway returns parseable plain JSON
                    # ({"object":"chat.completion","choices":[...]}). The
                    # SseStreamingHttpClient path is retained for the
                    # alternate gateway profile that ALWAYS streams.
                    "stream": False,
                },
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout_seconds,
            )
        except ProviderError as exc:
            # Codex review fix: post() was already invoked — even when the
            # client itself raises a ProviderError, exactly one failure audit
            # must be written. _audit_outbound_failure() swallows audit-side
            # errors so the ORIGINAL ProviderError is preserved as the primary
            # signal and never masked by an audit failure.
            self._audit_outbound_failure(field_names)
            raise
        except TimeoutError as exc:
            # An outbound attempt was made; audit it truthfully as failure.
            self._audit_outbound_failure(field_names)
            raise ProviderTimeoutError(f"provider timeout after {self._timeout_seconds}s") from exc
        except Exception as exc:  # transport-level failure -> recognized error
            self._audit_outbound_failure(field_names)
            raise ProviderRequestError(f"provider transport failure: {type(exc).__name__}") from exc

        if getattr(response, "status_code", 0) != 200:
            self._audit_outbound_failure(field_names)
            raise ProviderRequestError(
                f"provider returned status {getattr(response, 'status_code', 'unknown')}"
            )

        raw_text = getattr(response, "text", None)
        if raw_text is None:
            # httpx response exposes .text; fakes may return a str directly.
            raw_text = response
        if not isinstance(raw_text, str) or len(raw_text) > MAX_RESPONSE_CHARS:
            self._audit_outbound_failure(field_names)
            raise ProviderMalformedResponseError("provider response oversized or non-text")
        try:
            data = json.loads(raw_text)
            content = data["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise TypeError("choices[0].message.content is not a string")
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            self._audit_outbound_failure(field_names)
            raise ProviderMalformedResponseError("provider response is not valid chat JSON") from exc

        # The request succeeded; audit AFTER the attempt so the recorded
        # outcome matches reality (R-014 truthful audit metadata).
        self._audit_outbound(field_names, "success")
        return ProviderResult(
            text=content,
            model_identifier=self.model_identifier,
            outbound_field_names=field_names,
            degraded=False,
        )

    def _audit_outbound_failure(self, field_names: list[str]) -> None:
        """Audit a FAILED attempt without letting an audit-storage error
        replace the primary request failure.

        P2 (TASK-0040 fix): on an already-failing path the request error is
        the primary signal; an audit failure is swallowed (still degrading —
        the request failed anyway) so the caller sees the recognizable
        ProviderError it already expected.
        """
        try:
            self._audit_outbound(field_names, "failure")
        except ProviderError:
            pass  # audit failure on a failing request: keep the request error

    def _audit_outbound(self, field_names: list[str], outcome: str) -> None:
        """Record one outbound attempt with a truthful outcome.

        Triggered only when a request was actually attempted. ``outcome`` is
        success/failure (denied is not used here because the fail-closed
        gates return before any attempt and are not audited as egress).

        P2 (TASK-0040 fix): an audit-storage failure (callback or repository
        raise) must never escape as an arbitrary 500. It is converted to a
        recognizable ``ProviderRequestError`` so the service layer degrades
        to the local deterministic reason instead of crashing. On the success
        path this also guarantees an un-audited model text is never returned
        as success.
        """
        if self._on_outbound is None:
            return
        try:
            self._on_outbound(self.model_identifier, field_names, outcome)
        except Exception as exc:
            raise ProviderRequestError(
                f"outbound audit failure: {type(exc).__name__}"
            ) from exc


def _as_mapping(value: object) -> Mapping[str, object]:
    """Coerce dataclass objects (NormalizedAnnouncement) to a mapping so the
    whitelist assembler can process them; dicts pass through unchanged."""
    if isinstance(value, Mapping):
        return value
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    raise TypeError(f"outbound payload must be a mapping or dataclass, got {type(value).__name__}")


def _json_loads(text: str) -> object:
    """Module-level JSON parse helper (the ``json`` name is shadowed by the
    ``post(url, json=...)`` parameter in SseStreamingHttpClient)."""
    return json.loads(text)


def _json_dumps(value: object, *, ensure_ascii: bool = False) -> str:
    """Module-level JSON serialize helper (same shadowing reason)."""
    return json.dumps(value, ensure_ascii=ensure_ascii)


def _json_default(obj: object) -> object:
    """JSON encoder fallback: datetime -> ISO-8601 string (never leaks a
    secret; only whitelisted fields reach the payload)."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"unsupported payload value type: {type(obj).__name__}")


class SseStreamingHttpClient:
    """OpenAI-compatible SSE streaming client for providers that answer in
    Server-Sent-Events (used by some AI gateways, e.g. the alternate
    profile of the product-owner AI gateway at
    http://129.146.135.219:3000/v1).

    Reconciled 2026-08-24: an empirical probe on the production gateway
    showed that with ``stream:false`` the gateway returns a parseable
    non-streamed JSON body (``application/json`` chat-completion), so the
    default code path in ``AiReasonProvider.generate_reason`` uses
    ``stream:false`` and parses the response with ``json.loads(response.text)``.
    This SSE client is retained for the alternate gateway profile that
    ALWAYS streams (returns ``text/event-stream`` regardless of the
    ``stream`` request flag) and whose model text arrives in the non-standard
    ``delta.reasoning_details[].text`` array (standard ``delta.content`` is
    empty). This client consumes the SSE stream incrementally, aggregates
    ``delta.content`` and ``delta.reasoning_details[].text`` into one string,
    and returns an object shaped like the standard chat-completion JSON
    (``{"choices": [{"message": {"content": ...}}]}``) so the existing
    ``AiReasonProvider`` parsing works unchanged when the SSE client is
    injected.

    Contract: ``post(url, json=..., headers=..., timeout=...)`` returning an
    object with ``status_code`` and ``text`` (same as the other clients).
    Timeout / HTTP errors raise the recognizable provider errors so the
    service layer degrades (R-015/AC-007). An empty aggregated text is
    reported as malformed (never fabricated).
    """

    def __init__(
        self,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        transport=None,
        max_tokens: int | None = None,
    ) -> None:
        self._timeout_seconds = timeout_seconds
        self._transport = transport
        #: Optional API parameter added to the request body (NOT part of the
        #: outbound whitelist — it caps generation so a streaming reason does
        #: not run forever). None keeps the provider's request body unchanged.
        self._max_tokens = max_tokens

    def post(self, url, json, headers, timeout):
        import httpx

        body = dict(json)
        # The approved gateway REQUIRES stream=true: without it the SSE
        # stream is empty (a bare "[DONE]") because content chunks are only
        # emitted in streaming mode (VERIFIED 2026-08-22). max_tokens caps
        # generation; it is an API parameter, not part of the outbound
        # whitelist.
        body["stream"] = True
        if self._max_tokens is not None:
            body["max_tokens"] = self._max_tokens

        try:
            with httpx.Client(
                timeout=timeout,
                transport=self._transport,
            ) as client:
                with client.stream("POST", url, json=body, headers=headers) as response:
                    if response.status_code >= 400:
                        raise ProviderRequestError(
                            f"provider returned status {response.status_code}"
                        )
                    parts: list[str] = []
                    for line in response.iter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            chunk = _json_loads(payload)
                        except ValueError:
                            continue
                        for choice in chunk.get("choices", []):
                            delta = choice.get("delta") or {}
                            content = delta.get("content")
                            if isinstance(content, str) and content:
                                parts.append(content)
                            for rd in delta.get("reasoning_details") or []:
                                text = rd.get("text") if isinstance(rd, dict) else None
                                if isinstance(text, str) and text:
                                    parts.append(text)
        except ProviderError:
            raise
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(
                f"provider timeout after {timeout}s"
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderRequestError(
                f"provider transport failure: {type(exc).__name__}"
            ) from exc

        aggregated = "".join(parts).strip()
        if not aggregated:
            raise ProviderMalformedResponseError(
                "provider SSE stream contained no text"
            )

        class _Resp:
            status_code = 200
            text = _json_dumps(
                {"choices": [{"message": {"content": aggregated}}]},
            )

        return _Resp()
