# TASK-0001 S3: Central policy projection and masking

- Date: 2026-07-27 Asia/Shanghai
- Owner: Codex / GPT-5.6-sol
- Status: PASSED
- Authorization: `TASK-0001` under `DEC-0046`
- Server write: none
- Data boundary: synthetic local test state only

## Scope delivered

- One fail-closed server-side record-read policy accepts an effective identity,
  record ownership, management scope and optional administrator exception reason.
- Pending, disabled, unassigned and out-of-scope identities receive the same
  generic denial before business data is projected.
- Record owners receive detailed current record/contact/follow-up information;
  other business users, general managers and in-scope managers receive the
  approved masked institution/contact data and concise progress only.
- Administrator full-detail access requires a nonblank reason and returns an
  explicit audit-required instruction for the later audit-write workflow. An
  administrator without that exception remains limited to any ordinary role it
  separately holds.
- The projection omits raw contact channels, raw source description/evidence,
  follow-up body, internal submission keys, business history and audit history
  from collaborator/management views.
- Record aggregates reject contacts or activities belonging to another
  institution before projection.

## Fail-closed mapping choices

The approved materials require a source *category* and a communication-method
*category* in collaborator views but do not define a category taxonomy or a
free-text normalization rule. The policy therefore accepts those as separate,
explicitly safe summary values. When either mapping is absent, the corresponding
collaborator field is empty; raw `source_kind` and raw `interaction_method` are
not substituted. This implements the approved default-hide rule without
inventing a business taxonomy.

Contact names use the fixed `***` mask in collaborator/management projections.
The mask does not preserve length, initials or another identifying fragment.

## Checks actually run

| Check | Environment | Result |
|---|---|---|
| `python -m compileall -q src tests migrations` | local native Python 3.12 environment | PASS |
| `python -m pytest -q tests/test_policy_projection.py` | local native Python 3.12 environment | `11 passed` |
| `python -m pytest -q` | local native Python plus isolated local PostgreSQL test database | `45 passed` |
| `python -m pip check` | local native Python 3.12 environment | `No broken requirements found` |

The policy tests cover owner detail, other-business-user masking, management
scope, administrator reason/audit requirement, pending/disabled/no-role denial,
deterministic concise progress, cross-record aggregate rejection and immutable
projection outputs. No actual administrator audit event is written in S3; that
is intentionally deferred to the S4 command/security workflow.

## Explicitly not done

- No command/query, data access repository, login/session endpoint, CSRF,
  rate-limit, audit persistence, Jinja2 page or JSON API was created.
- No migration was applied to Tencent; no server database record, service,
  systemd unit, nginx configuration, DNS/TLS setting or legacy CRM file changed.
- No Docker/Compose artifact, external AI call, paid service or real data was
  used.

## Next boundary

R1 is an independent foundation review of the S2/S3 mapping, tests and scope.
S4 cannot start until that review passes and any findings are reconciled.
