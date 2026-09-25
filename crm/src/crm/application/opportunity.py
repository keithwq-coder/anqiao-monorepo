"""SPEC-0003 v0.4.0 (TASK-0038): opportunity candidate service.

The opportunity is redefined: an AI (synthetic stub unless OD-006a grants a
real provider) surfaces a *candidate* for a "new business opportunity" with a
supporting reason, and a HUMAN adjudicates it (采纳/忽略). The AI has no
final judgment and never auto-files or creates a customer (R-003/R-017).

Two sources (R-005/R-006):
  - existing_customer: candidates derived from CRM records (cluster signal).
  - crawler: external public info (招投标/集采公告) surfaced by a synthetic
    crawler stub, retained 30 days (OD-001/DEC-0152).

Landings (R-007/R-008): adopting an existing_customer hit leaves the candidate
as the masked notification for the involved record owner; adopting a crawler
new subject releases it to the public pool (owner NULL + in_pool) so a
business user can claim it. Display never leaks another owner's protected
fields (R-009/R-010/R-013).
"""

from uuid import UUID

import re
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from crm.ai.provider import ProviderError
from crm.domain.models import Role, UserStatus
from crm.persistence.opportunity_candidate_repository import OpportunityCandidateRepository

MIN_CLUSTER_SIZE = 3
MIN_DISTINCT_OWNERS = 2
CRAWLER_RETENTION_DAYS = 30
SYNTHETIC_AI_MODEL = "synthetic-stub"

# R-013 hard boundary: AI-generated candidate/reason text is scanned before
# persist/display; a protected echo (phone-shaped value or another owner's
# source/evidence) must be suppressed — we fall back to a sanitized local
# reason rather than let the recipient infer protected data.
_PHONE_PATTERN = re.compile(r"1[3-9]\d{9}")


def resembles_phone(text: str) -> bool:
    """True when the text contains a phone-number-shaped value."""
    return _PHONE_PATTERN.search(text) is not None


def leak_scan(text: str, protected_values: Sequence[str]) -> list[str]:
    """Return leak findings for ``text`` (empty list = safe).

    Flags phone-shaped content and any verbatim protected value (e.g. another
    owner's source_description or evidence reference).
    """
    findings: list[str] = []
    if not text:
        return findings
    if resembles_phone(text):
        findings.append("phone-like value")
    for value in protected_values:
        if value and str(value) in text:
            findings.append("protected value echo")
    return findings


def _default_session_factory():
    from crm.config import Settings
    from crm.persistence.database import get_session_factory

    return get_session_factory(Settings())


def _default_audit_repository():
    from crm.persistence.audit_repository import AuditEventRepository

    return AuditEventRepository()


class OpportunityService:
    """AI-candidate generation, listing, and human adjudication for SPEC-0003."""

    def __init__(
        self,
        institution_repo,
        user_repo,
        session_factory=None,
        candidate_repo=None,
        audit_repository=None,
        crawler_source=None,
        reason_generator=None,
        crawler_reason_generator=None,
    ):
        self.institution_repo = institution_repo
        self.user_repo = user_repo
        self.session_factory = session_factory or _default_session_factory()
        self.candidate_repo = candidate_repo or OpportunityCandidateRepository()
        self.audit_repository = audit_repository or _default_audit_repository()
        # Inject a crawler source (real one gated by OD-006a); default is a
        # synthetic stub that returns no external data.
        self.crawler_source = crawler_source
        # Inject an AI reason generator (default = synthetic masked reason).
        # Useful to exercise the R-013 leak-scan with a leaky model.
        self.reason_generator = reason_generator
        # Inject an AI reason generator for crawler announcements (real
        # provider path, TASK-0040). It receives a NormalizedAnnouncement
        # (or a legacy subject dict) and is R-013-scanned like any AI text.
        self.crawler_reason_generator = crawler_reason_generator

    # ============ Discovery run (synthetic AI candidates) ============

    def run(self, user_id: UUID) -> dict:
        """Backward-compatible entry: runs the crawler source only (v0.5.0).

        Use ``run_personal(user_id)`` for personal opportunity discovery,
        ``run_crawler(actor_id)`` for scheduled crawler runs.
        """
        return self.run_crawler(user_id)

    def run_personal(self, user_id: UUID) -> dict:
        """SPEC-0003 v0.5.0 R-102: personal opportunity discovery.

        Generates AI candidates based on the caller's own customers
        (owner or custodian = ``user_id``). No clustering, no
        MIN_CLUSTER_SIZE threshold — each customer is a potential
        signal. The candidate is delivered to the caller.
        """
        from crm.persistence.database import transaction_session

        # Find the caller's own customers (owner or custodian).
        all_inst = self.institution_repo.find_active_for_duplicate_check()
        own = [
            i for i in all_inst
            if i.owner_user_id == user_id
            or (hasattr(i, 'custodian_user_id') and i.custodian_user_id == user_id)
        ]

        candidates = []
        for inst in own:
            # R-013: scan the AI-phrased reason before persist.
            reason_text, ai_used, model_id = self._apply_reason(
                self.reason_generator,
                inst,
                fallback=self._personal_fallback(inst),
                protected_values=self._personal_protected_values(inst),
                default_reason=self._personal_reason(inst),
            )
            candidates.append({
                "recipient_user_id": user_id,
                "source": "existing_customer",
                "candidate_text": self._personal_candidate_text(inst),
                "supporting_reason": reason_text,
                "key_uncertainties": self._personal_uncertainties(),
                "involved_records": [{
                    "institution_id": str(inst.id),
                    "name": inst.name,
                    "category": inst.category,
                    "region": inst.region,
                }],
                "external_subject": None,
                "expires_at": None,
                "ai_used": ai_used,
                "model_identifier": model_id,
            })

        generated = self._persist_candidates(candidates)
        used_real_model = any(
            c.get("model_identifier") not in (None, SYNTHETIC_AI_MODEL)
            for c in candidates
        )
        return {
            "generated": generated,
            "method": "personal",
            "synthetic": not used_real_model,
            "crawler_degraded": False,
            "crawler_degraded_reason": "",
        }

    def run_crawler(self, actor_id: UUID) -> dict:
        """SPEC-0003 v0.5.0 R-103: crawler-only discovery.

        Fetches external public announcements, matches against existing
        customers, and produces candidates. No personal clustering.
        """
        from crm.persistence.database import transaction_session

        candidates = []
        crawler_degraded = False
        crawler_degraded_reason = ""

        if self.crawler_source is not None:
            if hasattr(self.crawler_source, "fetch_announcements"):
                crawl_result = self.crawler_source.fetch_announcements()
                subjects = crawl_result.announcements
                crawler_degraded = crawl_result.degraded
                crawler_degraded_reason = crawl_result.degraded_reason
            else:
                subjects = self.crawler_source.list_external_subjects()
            for item in subjects:
                if hasattr(item, "to_subject_dict"):
                    subject = item.to_subject_dict()
                    reason_input = item
                else:
                    subject = item
                    reason_input = item
                expires_at = datetime.now(timezone.utc) + timedelta(days=CRAWLER_RETENTION_DAYS)
                reason_text, ai_used, model_id = self._apply_reason(
                    self.crawler_reason_generator,
                    reason_input,
                    fallback=self._crawler_reason(subject),
                    protected_values=[],
                    default_reason=self._crawler_reason(subject),
                )
                candidates.append({
                    "recipient_user_id": actor_id,
                    "source": "crawler",
                    "candidate_text": self._crawler_candidate_text(subject),
                    "supporting_reason": reason_text,
                    "key_uncertainties": self._crawler_uncertainties(),
                    "involved_records": None,
                    "external_subject": subject,
                    "expires_at": expires_at,
                    "ai_used": ai_used,
                    "model_identifier": model_id,
                })

        generated = self._persist_candidates(candidates)
        used_real_model = any(
            c.get("model_identifier") not in (None, SYNTHETIC_AI_MODEL)
            for c in candidates
        )
        return {
            "generated": generated,
            "method": "crawler",
            "synthetic": not used_real_model,
            "crawler_degraded": crawler_degraded,
            "crawler_degraded_reason": crawler_degraded_reason,
        }

    def _persist_candidates(self, candidates: list[dict]) -> int:
        """Persist a list of candidate dicts and return the count."""
        from crm.persistence.database import transaction_session

        generated = 0
        with transaction_session(self.session_factory) as session:
            for c in candidates:
                self.candidate_repo.create(
                    session=session,
                    recipient_user_id=c["recipient_user_id"],
                    source=c["source"],
                    candidate_text=c["candidate_text"],
                    supporting_reason=c["supporting_reason"],
                    key_uncertainties=c["key_uncertainties"],
                    involved_records=c["involved_records"],
                    external_subject=c["external_subject"],
                    expires_at=c["expires_at"],
                    ai_used=c.get("ai_used", True),
                    model_identifier=c.get("model_identifier", SYNTHETIC_AI_MODEL),
                )
                generated += 1
        return generated

    # ============ Candidate read paths ============

    def list_candidates(self, recipient_user_id: UUID) -> list[dict]:
        from crm.persistence.database import transaction_session

        with transaction_session(self.session_factory) as session:
            models = self.candidate_repo.list_for_recipient(
                session=session, recipient_user_id=recipient_user_id
            )
            return [self._to_dict(m) for m in models]

    def list_desensitized(self) -> list[dict]:
        """R-009: a desensitized read-only opportunity view (for gm).

        Only safe fields are exposed: id/source/status/candidate_text/
        observed timestamps. The supporting reason, involved records, and
        external subject reference are withheld so no protected data leaks.
        """
        from crm.persistence.database import transaction_session
        import sqlalchemy as sa
        from crm.persistence.models import OpportunityCandidateModel

        out: list[dict] = []
        with transaction_session(self.session_factory) as session:
            models = session.execute(
                sa.select(OpportunityCandidateModel).order_by(
                    OpportunityCandidateModel.discovered_at.desc()
                )
            ).scalars().all()
            for m in models:
                out.append({
                    "id": str(m.id),
                    "source": m.source,
                    "status": m.status,
                    "candidate_text": m.candidate_text,
                    "discovered_at": m.discovered_at.isoformat(),
                    "expires_at": m.expires_at.isoformat() if m.expires_at else None,
                })
        return out

    def get_candidate(self, recipient_user_id: UUID, candidate_id: UUID) -> dict | None:
        from crm.persistence.database import transaction_session

        with transaction_session(self.session_factory) as session:
            model = self.candidate_repo.find_by_id(session=session, candidate_id=candidate_id)
            if model is None or model.recipient_user_id != recipient_user_id:
                return None
            return self._to_dict(model)

    # ============ Human adjudication (R-003/R-007/R-008) ============

    def adjudicate(
        self,
        *,
        candidate_id: UUID,
        actor_user_id: UUID,
        decision: str,
    ) -> dict:
        """A HUMAN decides 采纳 or 忽略. The AI has no final judgment.

        Adopting an existing-customer candidate leaves it as the masked
        notification for the involved record owner. Adopting a crawler new
        subject releases it to the public pool (owner NULL + in_pool) so a
        business user can claim it.

        P1 (TASK-0040 fix): only the candidate's recipient may adjudicate.
        The ownership check happens BEFORE any state change, pool creation,
        or audit write; a non-recipient gets the same generic error as a
        missing candidate so candidate existence is not disclosed.
        """
        if decision not in ("采纳", "忽略"):
            raise ValueError("decision must be 采纳 or 忽略")

        from crm.persistence.database import transaction_session
        from crm.persistence.models import AuditEventModel, InstitutionModel

        with transaction_session(self.session_factory) as session:
            candidate = self.candidate_repo.find_by_id(
                session=session, candidate_id=candidate_id
            )
            if candidate is None:
                raise ValueError("candidate not found")
            # P1 ownership gate: non-recipients cannot adjudicate. Same
            # generic message as not-found -> no existence disclosure.
            if candidate.recipient_user_id != actor_user_id:
                raise ValueError("candidate not found")
            if candidate.status != "待处理":
                raise ValueError("candidate already adjudicated")

            self.candidate_repo.adjudicate(
                session=session,
                candidate=candidate,
                status=decision,
                actor_user_id=actor_user_id,
            )

            landed_as_pool = False
            if decision == "采纳" and candidate.source == "crawler" and candidate.external_subject:
                # R-008: new subject -> public pool (owner NULL + in_pool);
                # crawler is 直接采购-type per SPEC-0003 v0.4.0 §5.
                pool = InstitutionModel(
                    name=candidate.external_subject.get("name") or "外部招投标主体",
                    source_description="网络爬虫（公开招投标/集采公告）",
                    customer_type="direct_purchase",
                    owner_user_id=None,
                    in_pool=True,
                    created_by_user_id=actor_user_id,
                    idempotency_key=f"crawler-candidate-{candidate.id.hex}",
                )
                session.add(pool)
                session.flush()
                landed_as_pool = True

            session.add(AuditEventModel(
                actor_user_id=actor_user_id,
                action="opportunity_candidate.adjudicate",
                target_type="opportunity_candidate",
                target_id=candidate.id,
                outcome="success",
                reason=decision,
                after_state={"status": decision, "landed_as_pool": landed_as_pool},
            ))

        return {
            "candidate_id": str(candidate_id),
            "status": decision,
            "landed_as_pool": landed_as_pool,
        }

    # ============ Internals ============

    # ---- Personal (SPEC-0003 v0.5.0 R-102) ----

    @staticmethod
    def _personal_candidate_text(inst) -> str:
        return (
            f"AI 判断：客户「{inst.name}」（类别={inst.category or '无'}、"
            f"地区={inst.region or '无'}）可能存在尚未发现的商业机会"
            "（候选，需人裁定）。"
        )

    @staticmethod
    def _personal_reason(inst) -> str:
        return (
            f"理由：基于客户「{inst.name}」的档案信息（类别={inst.category or '无'}、"
            f"地区={inst.region or '无'}、来源={inst.source_kind or '无'}）"
            "，AI 分析认为该客户可能存在被忽略的跟进或交叉销售机会。"
            "本提示为 AI 候选 + 理由，未获确认，请负责人裁定是否采纳或忽略，"
            "系统不会自动建档。"
        )

    @staticmethod
    def _personal_uncertainties() -> str:
        return "客户当前需求是否明确、是否有新的业务切入点，均待人工核实。"

    @staticmethod
    def _personal_fallback(inst) -> str:
        return (
            f"系统注意到客户「{inst.name}」（类别={inst.category or '无'}、"
            f"地区={inst.region or '无'}）值得关注。本提示为未确认的候选，"
            "请负责人裁定，系统不会自动建档。"
        )

    @staticmethod
    def _personal_protected_values(inst) -> list[str]:
        values = []
        if inst.source_description:
            values.append(inst.source_description)
        if inst.source_evidence_reference:
            values.append(inst.source_evidence_reference)
        return values

    @staticmethod
    def _apply_reason(
        reason_generator,
        generator_input,
        *,
        fallback: str,
        protected_values: list[str],
        default_reason: str,
    ) -> tuple[str, bool, str | None]:
        """Resolve the supporting-reason text with the R-013 hard boundary.

        Returns ``(reason_text, ai_used, model_identifier)``.

        - No generator -> the deterministic default reason, marked as the
          synthetic stub (existing behavior).
        - Generator returns a str (tests / plain callables) -> leak-scan it;
          a hit falls back to ``fallback`` with ``ai_used=False``.
        - Generator returns a ``ProviderResult`` (real provider adapter) ->
          a degraded result means the external path was not used, so the
          synthetic default stays; otherwise scan the model text and fall
          back when it echoes protected content (AC-006).
        - Generator raises ``ProviderError`` (timeout / malformed / non-200 /
          transport, R-015/AC-007) -> degrade to the local deterministic
          ``fallback`` with ``ai_used=False``; discovery is never blocked.
        """
        if reason_generator is None:
            return default_reason, True, SYNTHETIC_AI_MODEL

        try:
            result = reason_generator(generator_input)
        except ProviderError:
            # R-015/AC-007: provider failure degrades to the local
            # deterministic reason; no AI text is used and discovery proceeds.
            return fallback, False, None
        if hasattr(result, "text") and hasattr(result, "degraded"):
            # ProviderResult from crm.ai.provider.
            if result.degraded:
                return default_reason, True, SYNTHETIC_AI_MODEL
            reason_text = result.text
            model_id = result.model_identifier or SYNTHETIC_AI_MODEL
        else:
            reason_text = str(result)
            model_id = SYNTHETIC_AI_MODEL
        if leak_scan(reason_text, protected_values):
            return fallback, False, None
        return reason_text, True, model_id

    @staticmethod
    def _clusters(institutions) -> list[list]:
        groups: dict[tuple[str, str], list] = {}
        for inst in institutions:
            if not inst.region or not inst.category:
                continue
            groups.setdefault((inst.region, inst.category), []).append(inst)
        return list(groups.values())

    @staticmethod
    def _masked_involved_records(cluster: list) -> list[dict]:
        return [
            {
                "institution_id": str(inst.id),
                "name": inst.name,
                "category": inst.category,
                "region": inst.region,
            }
            for inst in sorted(cluster, key=lambda i: str(i.id))
        ]

    def _recipient_for(self, owner_user_id: UUID) -> UUID | None:
        owner = self.user_repo.find_by_id(owner_user_id)
        if owner is not None and owner.status == UserStatus.ENABLED:
            return owner_user_id
        return None

    def _enabled_business_recipients(self) -> list[UUID]:
        # Collateral: deliver crawler candidates to an enabled business user.
        # In this synthetic scope we fall back to the candidate's own actor in
        # the route; kept minimal for the stub.
        return []

    @staticmethod
    def _existing_candidate_text(cluster: list) -> str:
        region = cluster[0].region
        category = cluster[0].category
        return (
            f"AI 判断：区域【{region}】、类别【{category}】下有 {len(cluster)} 条客户记录"
            "分属不同负责人，可能构成尚未识别的跨客户业务机会（候选，需人裁定）。"
        )

    @staticmethod
    def _existing_reason(cluster: list) -> str:
        region = cluster[0].region
        category = cluster[0].category
        return (
            f"理由：同区域【{region}】同类别【{category}】的多条客户由不同负责人分别跟进，"
            "可能存在被忽略的协同/交叉销售机会。本提示为 AI 候选 + 理由，未获确认，"
            "请负责人裁定是否采纳或忽略，系统不会自动建档。"
        )

    @staticmethod
    def _existing_uncertainties() -> str:
        return "各客户间是否确有业务往来、对方当前需求是否明确，均待人工核实。"

    @staticmethod
    def _cluster_protected_values(cluster: list) -> list[str]:
        """Collect other-owner protected values (source descriptions and
        evidence references) so the leak-scan can suppress a verbatim echo."""
        values: list[str] = []
        for inst in cluster:
            if inst.source_description:
                values.append(inst.source_description)
            if inst.source_evidence_reference:
                values.append(inst.source_evidence_reference)
        return values

    @staticmethod
    def _sanitized_reason(cluster: list) -> str:
        """R-013 fallback: a deterministic, fully masked reason that can never
        carry another owner's protected fields (region/category only)."""
        region = cluster[0].region
        category = cluster[0].category
        return (
            f"系统发现 {len(cluster)} 条客户同属区域【{region}】、类别【{category}】"
            "且由不同负责人跟进，可能存在被忽略的跨客户业务机会。本提示为未确认的"
            "候选，请负责人裁定，系统不会自动建档。"
        )

    @staticmethod
    def _crawler_candidate_text(subject: dict) -> str:
        return f"AI 判断：外部公开信息中出现可能的招投标/集采机会（{subject.get('name', '')}）。"

    @staticmethod
    def _crawler_reason(subject: dict) -> str:
        return (
            "理由：来自公开招投标/集采公告的候选，经爬虫采集（留存 30 天）。仅供参考，"
            "是否作为新客户进入公池、由业务人员认领，由人裁定。"
        )

    @staticmethod
    def _crawler_uncertainties() -> str:
        return "主体是否已存在、能否满足业务条件，均待人工核实。"

    @staticmethod
    def _to_dict(model) -> dict:
        return {
            "id": str(model.id),
            "recipient_user_id": str(model.recipient_user_id),
            "source": model.source,
            "status": model.status,
            "candidate_text": model.candidate_text,
            "supporting_reason": model.supporting_reason,
            "key_uncertainties": model.key_uncertainties,
            "involved_records": model.involved_records,
            "external_subject": model.external_subject,
            "discovered_at": model.discovered_at.isoformat(),
            "expires_at": model.expires_at.isoformat() if model.expires_at else None,
            "read": model.read,
            "ai_used": model.ai_used,
            "model_identifier": model.model_identifier,
            "adjudicated_at": model.adjudicated_at.isoformat() if model.adjudicated_at else None,
            "adjudicated_by_user_id": (
                str(model.adjudicated_by_user_id) if model.adjudicated_by_user_id else None
            ),
        }
