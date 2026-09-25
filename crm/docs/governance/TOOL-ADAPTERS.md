# Cross-tool entry points

`AGENTS.md` is the only canonical project operating contract. Adapters exist to
improve discovery, not to duplicate policy.

| Tool | Repository entry | Loading status | Required action |
|---|---|---|---|
| Codex | `AGENTS.md` | Repository entry present | Confirm it was read |
| Claude Code | `CLAUDE.md` -> `AGENTS.md` | Adapter present | Confirm both were read |
| Cursor | `.cursor/rules/00-project-governance.mdc` -> `AGENTS.md` | Always-apply rule present | Confirm referenced files were loaded |
| Qoder | `QODER.md` -> `AGENTS.md` | Automatic discovery unverified | Manually add/attach `AGENTS.md` as the project rule |
| ZCode | `ZCODE.md` -> `AGENTS.md` | Automatic discovery unverified | Manually attach `AGENTS.md` to the task context |
| Other tools/models | `AGENTS.md` | Unknown | Attach the file explicitly and ask the model to report what it read |

## Session opening prompt

Use this when a tool does not have a verified automatic adapter:

```text
Before acting, read AGENTS.md, docs/NOW.md, docs/PROJECT.md,
docs/specs/INDEX.md, and docs/decisions/DECISION-LOG.md. Report which files
were actually read, the current SDD phase, whether an approved SPEC and active
task exist, assumptions, and unknowns. Do not edit application code unless all
four implementation gates in AGENTS.md section 5 are satisfied.
```

## Drift control

- Never paste a full second copy of `AGENTS.md` into an adapter.
- When the canonical rules change, run `scripts/check-governance.ps1`.
- Tool memory, generated repository wikis, and old sessions are convenience
  context only. Reconcile them against repository files every session.
- Do not assign permanent authority by model name. A reviewer may catch errors
  from an implementer regardless of which model is considered stronger.
- When a task requests a particular model, the session must report the model
  actually active. A tool label or user preference is not proof of model
  selection.
- Task-specific implementation/review routing is recorded in
  `docs/governance/MODEL-ROUTING.md` and the active task, not duplicated in an
  adapter.
