# Governance initialization evidence

- Date: 2026-07-26
- Environment: Windows PowerShell, repository
  `D:\Project\中科安樵\crm`, branch `main`, uncommitted workspace
- Scope: governance and SDD documentation only; no application code

## Checks actually run

| Command/check | Result | What it proves | What it does not prove |
|---|---|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` | PASS | Required adapters, lifecycle paths, legacy manifest, approved-SPEC gates, and active-task gates are structurally consistent | No product behavior or application implementation exists |
| PowerShell `ConvertFrom-Json` over all repository JSON files | PASS, 2 files | Current JSON files are syntactically parseable | JSON semantics or future generated output |
| PowerShell relative-link scan over 33 non-legacy Markdown files | PASS | Local Markdown targets resolve; legacy snapshot intentionally excluded | External URLs, rendered Markdown, or human readability |
| Repository inspection and status | PASS | No application code, approved SPEC, or active implementation task was found; new files are uncommitted | Runtime, build, deployment, or visual acceptance |

## Current authority state

- Approved SPECs: 0
- Active tasks: 0
- Legacy manifests checked: 1
- Engineering sequence: proposal in
  `docs/governance/DEVELOPMENT-SEQUENCE.md`
- Draft SPEC: `docs/specs/10-draft/SPEC-0001-core-record-activity.md`
- Implementation authorization: none
