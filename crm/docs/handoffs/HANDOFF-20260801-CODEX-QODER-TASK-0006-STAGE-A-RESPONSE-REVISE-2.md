# HANDOFF-20260801-CODEX-QODER-TASK-0006-STAGE-A-RESPONSE-REVISE-2

- Task: `TASK-0006` Stage A response-contract correction, second revision
- From tool/model: Codex / GPT-5, coordinator and independent reviewer
- To tool/model: Qoder / exact runtime model must be self-reported
- Execution owner: Qoder
- Reviewer and acceptance owner: Codex
- Authority: `DEC-0062`, `DEC-0063`, and `DEC-0064`
- Governing draft: `SPEC-GOV-0001` rules `R-017` through `R-022`
- Handoff status: HANDOFF-ONLY / RESPONSE REVISE-2 ASSIGNED
- Written at: 2026-08-01 Asia/Shanghai

## Transport contract

The product owner transports this prompt verbatim. Do not rely on prior chat,
do not ask the product owner to interpret findings, and do not add a narrative
before or after the required response.

This is a read-only response correction. Do not edit any repository file, do not
start Stage B, and do not claim that TASK-0006 or Stage A is complete or
accepted.

## Required reading

Read `AGENTS.md`, `QODER.md`, `docs/decisions/DECISION-LOG.md`,
`docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`, and
the complete prior execution prompt:

`docs/handoffs/HANDOFF-20260801-CODEX-QODER-TASK-0006-STAGE-A-RESPONSE-REVISE.md`

## Reviewer findings to correct

The previous Qoder response is rejected for these exact reasons:

1. `Runtime model: Qoder` is a tool name, not an exact runtime model
   identifier. Report the actual identifier exposed by the runtime. If no
   exact identifier is available, stop and report `BLOCKED`; do not substitute
   `Qoder`, `Qoder / Exact runtime model must be self-reported`, or any guess.
2. The temporary manifest paths were reported as `$env\TEMP\...`, which is not
   the actual path syntax or resolved path. Report the literal `FullName` values
   from `Get-Item`.
3. The complete response was duplicated. Emit exactly one response with no
   preamble, postscript, explanation, or second copy.

The repository evidence itself remains unchanged and independently verified:

| File | Current SHA-256 |
|---|---|
| `docs/NOW.md` | `8182E07745F0ECF167047CB926E715CB93FC56397E07C4258589213ECA39BD00` |
| `docs/PROJECT.md` | `75DA556501EE1B45D4AD76357B5DF982301DC09C07393CC1E7E40D84BB6746DC` |
| `docs/specs/INDEX.md` | `334271CABD361623977C96CD7EFFEDCC7DF8EA70D72DD3CFC27526EFFD46EFC1` |
| `docs/specs/SPEC-BASELINE.md` | `FFEC0107437441C882F9FCC3BFC813CC5833772DE80B8FC8136D38B77AEBC633` |
| `docs/governance/DEVELOPMENT-SEQUENCE.md` | `2D9F6B0EDA5CFA0435ED046C5A89B44C47ED12B4CF683950AD7DA8F2E731E2F0` |

The exact temporary manifests currently present on this host are:

- `C:\Users\K\AppData\Local\Temp\TASK-0006-STAGE-A-RESPONSE-before.json`
- `C:\Users\K\AppData\Local\Temp\TASK-0006-STAGE-A-RESPONSE-after.json`

## Execution

1. Re-read and execute the mandatory read-only acceptance block in the prior
   handoff exactly once. Do not edit the repository.
2. Confirm the two manifest files with:
   `Get-Item -LiteralPath (Join-Path $env:TEMP 'TASK-0006-STAGE-A-RESPONSE-before.json'), (Join-Path $env:TEMP 'TASK-0006-STAGE-A-RESPONSE-after.json') | Select-Object -ExpandProperty FullName`
3. Capture the actual five current hash lines, the actual `CHANGED_PATHS=`
   line, the seven approved-SPEC hash lines, and the governance output.
4. Determine the exact runtime model identifier from the Qoder runtime. If it
   cannot be determined exactly, stop and use the BLOCKED response below.

## Forbidden scope

- No repository file edits or creation, including handoffs, task files,
  decisions, SPECs, approval JSON, source, tests, scripts, or configuration.
- No network, server, service, browser, database, migration, import, deployment,
  restart, real-data access, secret access, commit, push, reset, clean, or delete.
- No Stage B and no acceptance claim for any task or gate.

## Required response when every read-only check passes

Return exactly these sections once, with no other text:

```text
Status: HANDOFF-ONLY / AWAITING CODEX ACCEPTANCE
Stage: TASK-0006 Stage A response-contract correction only
Runtime model: <exact runtime identifier, not Qoder>
Files changed: none (read-only revalidation)
Current hashes:
<the five actual CURRENT_SHA256 lines>
Temporary manifest:
<the two literal resolved FullName paths>
Changed-path audit:
<the actual CHANGED_PATHS= line>
Acceptance output:
<the seven actual APPROVED_SPEC_SHA256_OK lines>
<the actual governance output>
[PASS] TASK-0006 Stage A response-contract revalidation passed.
Not verified: current online database/service state; W4/S5/S6 acceptance
Decisions needed: none for response-contract revalidation
```

`COMPLETE`, `ACCEPTED`, and any task/stage completion wording are forbidden.
The word `PASS` may appear only in the literal command output shown above.

## Required response when the exact runtime identifier is unavailable or any
## check fails

Return exactly these sections once, with no other text:

```text
Status: BLOCKED
Stage: TASK-0006 Stage A response-contract correction only
Runtime model: exact identifier unavailable
Failed requirement: <exact requirement>
Exact error/output: <exact error or output>
Files changed: none (read-only stage)
```

Do not claim completion or acceptance. The product owner transports this single
response back to Codex; Codex remains the independent acceptance owner.
