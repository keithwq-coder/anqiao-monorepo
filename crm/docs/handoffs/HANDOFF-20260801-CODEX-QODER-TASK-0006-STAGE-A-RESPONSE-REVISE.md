# HANDOFF-20260801-CODEX-QODER-TASK-0006-STAGE-A-RESPONSE-REVISE

- Task: `TASK-0006` Stage A response-contract correction and read-only revalidation
- From tool/model: Codex / GPT-5, coordinator and independent reviewer
- To tool/model: Qoder / exact runtime model must be self-reported
- Execution owner: Qoder
- Reviewer and acceptance owner: Codex
- Authority: `DEC-0062`, `DEC-0063`, and `DEC-0064`
- Governing draft: `SPEC-GOV-0001` rules `R-017` through `R-022`
- Handoff status: HANDOFF-ONLY / RESPONSE REVISE ASSIGNED
- Repository state: `main` has no commits and current files are untracked
- Written at: 2026-08-01 Asia/Shanghai

## Transport contract

This file is the complete execution prompt. The product owner only transports
it verbatim. Do not ask the product owner to interpret the previous verdict,
rewrite the prompt, choose commands, or merge context.

This is a read-only response-contract correction. Do not edit repository files,
do not start Stage B, and do not claim that TASK-0006 or Stage A is complete or
accepted. Execute the checks below in one Qoder turn and report the required
response sections exactly.

## Required reading

Read these files from the repository before running the checks:

1. `AGENTS.md` in full.
2. `QODER.md`.
3. `docs/NOW.md`.
4. `docs/PROJECT.md`.
5. `docs/specs/INDEX.md`.
6. `docs/decisions/DECISION-LOG.md`, especially `DEC-0062`, `DEC-0063`, and
   `DEC-0064`.
7. `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`.
8. The five inspected files listed below.

Before running the acceptance block, state the current phase, the exact
runtime model identifier, assumptions, unknowns, and the read-only scope.
If the runtime cannot be reported as an exact identifier, stop and report
`BLOCKED`; do not write a placeholder such as `Qoder / Exact runtime model
must be self-reported`.

## Verified reviewer findings

Codex independently observed the following current hashes and semantic state:

| File | Current SHA-256 |
|---|---|
| `docs/NOW.md` | `8182E07745F0ECF167047CB926E715CB93FC56397E07C4258589213ECA39BD00` |
| `docs/PROJECT.md` | `75DA556501EE1B45D4AD76357B5DF982301DC09C07393CC1E7E40D84BB6746DC` |
| `docs/specs/INDEX.md` | `334271CABD361623977C96CD7EFFEDCC7DF8EA70D72DD3CFC27526EFFD46EFC1` |
| `docs/specs/SPEC-BASELINE.md` | `FFEC0107437441C882F9FCC3BFC813CC5833772DE80B8FC8136D38B77AEBC633` |
| `docs/governance/DEVELOPMENT-SEQUENCE.md` | `2D9F6B0EDA5CFA0435ED046C5A89B44C47ED12B4CF683950AD7DA8F2E731E2F0` |

The semantic required-text and forbidden-text checks, the seven approved SPEC
hash checks, and `scripts/check-governance.ps1` passed when Codex reran them.

The transported Qoder response was not acceptable because it claimed
`TASK-0006 Stage A Revision - COMPLETE`, did not report an exact runtime model,
and the required revision manifest
`$env:TEMP\TASK-0006-STAGE-A-REVISE-before.json` was not present when Codex
checked the host. This prompt repairs the response evidence without asking for
another edit of the already-correct five files.

## Read-only scope

Inspect exactly these five target files and use the governance files required by
the checks:

1. `docs/NOW.md`
2. `docs/PROJECT.md`
3. `docs/specs/INDEX.md`
4. `docs/specs/SPEC-BASELINE.md`
5. `docs/governance/DEVELOPMENT-SEQUENCE.md`

Temporary JSON manifests may be written under `$env:TEMP` only. No repository
file may be created, edited, deleted, renamed, reset, committed, or pushed.

## Forbidden scope

- No application, test, task, evidence, SPEC, approval JSON, decision-log,
  handoff, script, dependency, deployment, archive, or configuration edits.
- No network, server, service, browser, database, migration, import, deployment,
  restart, real-data access, secret access, commit, push, reset, clean, delete,
  or broad formatting.
- No Stage B and no acceptance claim for TASK-0006, Stage A, W4, S5, S6,
  TASK-0002, reusable TASK-0003 capability, or any later task.

## Mandatory read-only acceptance block

Run this block from `D:\Project\中科安樵\crm`:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$owned = @(
  'docs/NOW.md',
  'docs/PROJECT.md',
  'docs/specs/INDEX.md',
  'docs/specs/SPEC-BASELINE.md',
  'docs/governance/DEVELOPMENT-SEQUENCE.md'
)
$expected = [ordered]@{
  'docs/NOW.md' = '8182E07745F0ECF167047CB926E715CB93FC56397E07C4258589213ECA39BD00'
  'docs/PROJECT.md' = '75DA556501EE1B45D4AD76357B5DF982301DC09C07393CC1E7E40D84BB6746DC'
  'docs/specs/INDEX.md' = '334271CABD361623977C96CD7EFFEDCC7DF8EA70D72DD3CFC27526EFFD46EFC1'
  'docs/specs/SPEC-BASELINE.md' = 'FFEC0107437441C882F9FCC3BFC813CC5833772DE80B8FC8136D38B77AEBC633'
  'docs/governance/DEVELOPMENT-SEQUENCE.md' = '2D9F6B0EDA5CFA0435ED046C5A89B44C47ED12B4CF683950AD7DA8F2E731E2F0'
}
$excluded = '\\.git|\\.venv|\\node_modules|\\__pycache__|\\.playwright-mcp|\\.qoder|\\.claude|\\.cursor|\\.pytest_cache'

foreach ($relative in $owned) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -cne $expected[$relative]) {
    throw "CURRENT HASH MISMATCH: $relative expected=$($expected[$relative]) actual=$actual"
  }
  "CURRENT_SHA256 $relative $actual"
}

function Get-Manifest {
  @(Get-ChildItem -LiteralPath $root -Recurse -Force -File |
    Where-Object { $_.FullName -notmatch $excluded } |
    Sort-Object FullName |
    ForEach-Object {
      [pscustomobject]@{
        Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
        Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
      }
    })
}

$beforePath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-RESPONSE-before.json'
$afterPath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-RESPONSE-after.json'
$beforeRows = Get-Manifest
ConvertTo-Json -InputObject $beforeRows -Depth 3 | Set-Content -LiteralPath $beforePath -Encoding UTF8
$afterRows = Get-Manifest
ConvertTo-Json -InputObject $afterRows -Depth 3 | Set-Content -LiteralPath $afterPath -Encoding UTF8
$before = @{}
$after = @{}
foreach ($row in $beforeRows) { $before[$row.Path] = $row.Sha256 }
foreach ($row in $afterRows) { $after[$row.Path] = $row.Sha256 }
$allPaths = @($before.Keys) + @($after.Keys) | Sort-Object -Unique
$changed = @($allPaths | Where-Object {
  (-not $before.ContainsKey($_)) -or
  (-not $after.ContainsKey($_)) -or
  ($before[$_] -cne $after[$_])
})
if ($changed.Count -ne 0) {
  throw "READ-ONLY CHECK CHANGED PATHS: $($changed -join ',')"
}
'CHANGED_PATHS='

$requiredLines = @(
  '## Current adjudication (2026-07-31, TASK-0006)',
  '- [VERIFIED] DEC-0058 records that 117 imported records were present in the cloud database on 2026-07-30.',
  "- [VERIFIED] DEC-0059 records the product owner's risk acceptance for the publicly reachable debug service reported at that time.",
  '- [UNKNOWN] TASK-0006 did not access the network; the current online database and service state is unknown.',
  '- [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.',
  '- [VERIFIED] TASK-0001 is the explicitly authorized implementation task.',
  '- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata and is not currently accepted.',
  "- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import capability remains unauthorized.",
  '- [VERIFIED] TASK-0006 is a documentation task owned by Qoder and remains HANDOFF-ONLY pending Codex acceptance.',
  '- [PROPOSAL] TASK-0007 through TASK-0011 are PROPOSED/UNAUTHORIZED.'
)
$forbidden = @(
  'zero public tables', 'no public tables', 'dedicated database remains empty',
  'empty dedicated database', 'no service/release exists',
  'Applying a migration to the cloud database for real data tier',
  'no business behavior', 'permanent database object',
  'four active implementation tasks', 'TASK-0001 through TASK-0003 have been authorized',
  'Qoder executed documentation reconciliation', 'third revision cycle'
)
foreach ($relative in $owned) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $relative).Path)
  foreach ($line in $requiredLines) {
    if (-not $text.Contains($line)) { throw "MISSING REQUIRED TEXT in $relative :: $line" }
  }
  if ([regex]::Matches($text, [regex]::Escape($requiredLines[0])).Count -ne 1) {
    throw "ADJUDICATION HEADING COUNT IS NOT ONE: $relative"
  }
  foreach ($phrase in $forbidden) {
    if ($text.IndexOf($phrase, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      throw "FORBIDDEN STALE CLAIM in $relative :: $phrase"
    }
  }
}

$nowText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/NOW.md').Path)
if (-not $nowText.Contains('W4 was authorized under DEC-0053 and re-authorized under DEC-0055; its formal acceptance remains NOT VERIFIED.')) { throw 'NOW.md W4 boundary missing' }
$indexText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/specs/INDEX.md').Path)
if (-not $indexText.Contains('Last updated: 2026-08-01 (TASK-0006 Stage A revision)')) { throw 'INDEX.md last-updated marker missing' }
if (-not $indexText.Contains('Stage A remains unaccepted until Codex independently accepts both the changed-path and semantic checks.')) { throw 'INDEX.md Stage A boundary missing' }
if (-not $indexText.Contains('10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md')) { throw 'SPEC-GOV-0001 draft row missing' }
$sequenceText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/governance/DEVELOPMENT-SEQUENCE.md').Path)
if (-not $sequenceText.Contains('[TASK-0006 DOCUMENTATION] Stage A revision is in execution under DEC-0062 through DEC-0064 and remains HANDOFF-ONLY pending Codex acceptance.')) { throw 'Stage A revision sentence missing' }

Get-ChildItem -LiteralPath 'docs/specs/30-approved' -Filter '*.approval.json' |
  ForEach-Object {
    $meta = [System.IO.File]::ReadAllText($_.FullName) | ConvertFrom-Json
    $specPath = Join-Path $_.DirectoryName $meta.spec_file
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $specPath).Hash.ToLowerInvariant()
    if ($actual -cne $meta.spec_sha256.ToLowerInvariant()) { throw "APPROVED SPEC HASH MISMATCH: $specPath" }
    "APPROVED_SPEC_SHA256_OK $($meta.spec_id) $actual"
  }

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-governance.ps1
if ($LASTEXITCODE -ne 0) { throw "Governance check failed with exit code $LASTEXITCODE" }
'[PASS] TASK-0006 Stage A response-contract revalidation passed.'
```

## Required response

If every check passes, respond with exactly these sections and actual output:

1. `Status: HANDOFF-ONLY / AWAITING CODEX ACCEPTANCE`
2. `Stage: TASK-0006 Stage A response-contract correction only`
3. `Runtime model: <exact identifier>`
4. `Files changed: none (read-only revalidation)`
5. `Current hashes:` the five actual `CURRENT_SHA256` lines
6. `Temporary manifest:` the two exact paths used
7. `Changed-path audit:` the actual `CHANGED_PATHS=` line
8. `Acceptance output:` seven approved-SPEC hash lines, governance output, and
   the final response-contract PASS line
9. `Not verified:` current online database/service state; W4/S5/S6 acceptance
10. `Decisions needed: none for response-contract revalidation`

Do not include `COMPLETE`, `ACCEPTED`, `PASS` as a task/stage status, or any
claim that Stage A is accepted. The word `PASS` is allowed only inside the
literal command output required above. Do not start Stage B.

If any check fails or the exact runtime identifier cannot be reported, respond
instead with exactly:

1. `Status: BLOCKED`
2. the exact failed command or requirement
3. the exact error output
4. `Files changed: none (read-only stage)` unless a forbidden edit occurred
5. no completion or acceptance claim

The product owner will transport the response back to Codex. Codex remains the
independent acceptance owner for TASK-0006 Stage A.
