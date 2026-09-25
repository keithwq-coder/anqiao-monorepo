# HANDOFF-20260728-GR1-recovery

- Task: TASK-0001 / GR1 recovery
- From tool/model: Codex / GPT-5.6-sol
- To tool/model: Next repository agent (must identify itself)
- Handoff status: HANDOFF-ONLY
- Repository state: uncommitted; see `docs/decisions/DECISION-LOG.md`,
  `docs/NOW.md`, `docs/tasks/TASKS.md`,
  `docs/tasks/active/TASK-0001-manual-core-record-activity.md`, and
  `docs/evidence/TASK-0001-GR1-w3-recovery.md`
- Written at: 2026-07-28 Asia/Shanghai

## Required reading

- `AGENTS.md`
- `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`, and
  `docs/specs/SPEC-BASELINE.md`
- all seven files in `docs/specs/30-approved/` and their `.approval.json` files
- `docs/decisions/DECISION-LOG.md`, especially `DEC-0044` through `DEC-0049`
- `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
- `docs/evidence/TASK-0001-GR1-w3-recovery.md`

## Verified current state

- [VERIFIED] `DEC-0049` records the product-owner authorization for GR1.
- [VERIFIED] The Tencent database `anqiao_crm` has zero public tables after GR1.
  No migration, seed, service, release, nginx, TLS, DNS, or legacy cutover was
  performed.
- [VERIFIED] `anqiao_crm_app` is enabled with the intended least-privilege
  flags, connection limit 20, and a SCRAM verifier. A root-only connection test
  using the restricted runtime file succeeded without exposing a secret.
- [VERIFIED] `/tmp/anqiao-src`, `/tmp/deploy-test`, and
  `/opt/anqiao-crm/releases/current` were moved, not deleted, to the root-only
  GR1 quarantine directory.
- [BLOCKED] `anqiao-crm` cannot traverse `/opt/anqiao-crm` or `shared/`, which
  remain `ubuntu:ubuntu` mode `0750`. Therefore the service identity cannot read
  its own mode-`0600` runtime file. No parent-directory permission change was
  made because GR1 did not authorize it.
- [VERIFIED] The task truth was corrected: R1, S4, S5, S6, G5, and W4 are
  `PENDING`; do not rely on pre-existing code or evidence files as accepted
  completion evidence.

## Changes made

- Added `DEC-0049` to record the authorization and failure boundary.
- Added GR1 evidence, corrected `NOW`, the task index, and TASK-0001 status
  records.
- No application source, approved SPEC, server service, nginx configuration, or
  other project resource was changed by this recovery handoff.

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| Controlled SSH preflight and GR1 recovery scripts | Tencent server | PARTIAL | `docs/evidence/TASK-0001-GR1-w3-recovery.md` |
| Root-only runtime-file PostgreSQL connection | Tencent server | PASS | `docs/evidence/TASK-0001-GR1-w3-recovery.md` |
| `nginx -t` | Tencent server | PASS | `docs/evidence/TASK-0001-GR1-w3-recovery.md` |
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | local repository | PASS: 7 approved SPECs, 1 active task, 1 legacy manifest | current session |

## Failed or not verified

- Service-account runtime-file access remains unverified and currently fails due
  to the parent directory permissions described above.
- R1 independent review, every S4+ acceptance check, Tencent migration,
  synthetic data, application process, pages/APIs, deployment, TLS/DNS, backup,
  and human acceptance remain unverified.
- No real data was imported or read.

## Next bounded action

Do not make another server write. Prepare a narrow GR2 proposal to grant only
the `anqiao-crm` service identity traversal of
`/opt/anqiao-crm` and `/opt/anqiao-crm/shared`, with a preflight proving no
other project shares those paths, explicit metadata rollback, and a fresh
product-owner authorization. GR2 must not include a migration, release,
systemd, nginx, TLS, DNS, or legacy-site action.
