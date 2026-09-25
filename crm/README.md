# CRM project workspace

This repository contains governance plus the implemented CRM application. The
working model: project facts live in files, specifications must be approved
before implementation, and every claim of completion must have reproducible
evidence.

## Start here

For the product owner:

1. Read [docs/NOW.md](docs/NOW.md) for the current state and next decision.
2. Read [docs/specs/INDEX.md](docs/specs/INDEX.md) to see which specifications
   are drafts, in review, approved, or only historical references.
3. Read [docs/decisions/DECISION-LOG.md](docs/decisions/DECISION-LOG.md) for
   decisions that are actually in force.
4. Read [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
   for the factual current architecture baseline.

For any AI tool or model:

1. Read [AGENTS.md](AGENTS.md) in full.
2. Read `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`, and the active
   task, if one exists.
3. Run `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   before claiming the repository is ready.

## Current boundary

- The complete approved SPEC baseline is COMPLETE
  (`docs/specs/SPEC-BASELINE.md`); 8 approved SPECs
  (`SPEC-0001/0002/0003/0008/0011/0012/0013/0014`) carry matching approval
  metadata. SPEC approval does not by itself authorize application code; an
  active, explicitly authorized task is required per `AGENTS.md` section 5.
- The implemented architecture is a cloud-deployed Python modular monolith
  (FastAPI, central `policy` projection layer, PostgreSQL + Alembic,
  server-side sessions, Jinja2 server-rendered pages, Uvicorn behind nginx, no
  Docker). See `docs/architecture/ARCHITECTURE.md` and
  `docs/decisions/ADR-0003-current-cloud-modular-monolith.md`. Current
  production runtime state is NOT VERIFIED in documentation.
- All engineering work is performed by AI tools; the product owner does not
  write code or run engineering commands. Cross-tool dispatch follows the
  verdict-only protocol (`DEC-0124`) and
  `docs/governance/MODEL-ROUTING.md` / `docs/governance/WORKFLOW.md`.
- Planning is completion-gated and dependency-driven. The project has no
  deadlines, ETAs, or calendar delivery timeline.
- The previous SPEC files are preserved under `docs/specs/99-legacy/` as
  untrusted reference material. They do not authorize implementation.
- This repository is an independent Git repository with an intentionally dirty
  worktree; existing changes and untracked files are preserved.

## Directory map

```text
docs/
  NOW.md                    Current plain-language control panel
  PROJECT.md                Confirmed facts and open questions
  architecture/             Factual architecture baseline (TASK-0022)
  decisions/                Human decisions, ADRs, and templates
  governance/               Workflow and cross-tool rules
  handoffs/                 Evidence-based transfers between tools/models
  specs/
    00-inbox/               Raw ideas; not specifications
    10-draft/               AI/user working drafts
    20-review/              Complete enough for human review
    30-approved/            The only implementation-authorizing specs
    90-deprecated/          Superseded approved specs
    99-legacy/              Historical, untrusted references
  tasks/                    Active work ownership and file locks
src/crm/                    Application source (domain/application/policy/
                            persistence/web/ai modules)
migrations/                 Alembic migrations
tests/                      Focused and cross-cutting test suites
scripts/
  check-governance.ps1      Local fail-closed governance check
```

Tool-specific entry files are adapters only. `AGENTS.md` remains the canonical
repository operating contract.
