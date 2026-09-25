# HANDOFF-20260731-CODEX-QODER-TASK-0006-STAGE-A

- Task: `TASK-0006` Stage A, canonical control-document reconciliation
- From tool/model: Codex / GPT-5, coordinator and independent reviewer
- To tool/model: Qoder / exact runtime model must be self-reported
- Execution owner: Qoder remains owner of all TASK-0006 stages
- Authority: `DEC-0062` and `DEC-0063`
- Handoff status: HANDOFF-ONLY / STAGE A ASSIGNED
- Repository state: `main` has no commits and all current files are untracked
- Written at: 2026-07-31 Asia/Shanghai

## Execute this prompt as written

Perform Stage A end to end in the same Qoder turn: preflight, edit, verify, and
report. Do not stop after describing a plan or preflight. Stop only if a hard
blocker or a failed check requires `BLOCKED` status.

This is not a new ownership assignment. Qoder retains sole execution ownership
of TASK-0006. Codex remains the independent reviewer. Stage B and Stage C also
remain assigned to Qoder, but they are not executable until Codex accepts this
Stage A result.

Do not use time, context, response-length, or token limits to omit a required
edit or check. If any requirement cannot be completed, preserve the worktree,
report `BLOCKED`, identify the exact failed item, and make no completion claim.

## Required reading before editing

Read these files from the repository, not from chat memory:

1. `AGENTS.md` in full.
2. `QODER.md`.
3. `docs/decisions/DECISION-LOG.md`, especially `DEC-0058`, `DEC-0059`,
   `DEC-0061`, `DEC-0062`, and `DEC-0063`.
4. `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md`.
5. `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`.
6. `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`.
7. Every Stage A owned file listed below.

Before editing, state the current phase, exact runtime model, assumptions,
unknowns, owned files, and forbidden scope. Then continue immediately into the
work in the same turn.

## Verified facts that must govern every edit

Use these facts exactly. Do not infer current runtime state from historical
decisions or local source:

- [VERIFIED] `DEC-0058` records that 117 imported records were present in the
  cloud database on 2026-07-30.
- [VERIFIED] `DEC-0059` records the product owner's risk acceptance for the
  publicly reachable debug service reported at that time.
- [UNKNOWN] TASK-0006 did not access the network; the current online database
  and service state is unknown.
- [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
- [VERIFIED] TASK-0001 is the explicitly authorized implementation task.
- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata
  and is not currently accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import
  capability remains unauthorized.
- [VERIFIED] TASK-0006 is a documentation task owned by Qoder and remains
  HANDOFF-ONLY pending Codex acceptance.
- [PROPOSAL] TASK-0007 through TASK-0011 are PROPOSED/UNAUTHORIZED.

`DEC-0059` does not prove the service is currently online. Local source does not
prove deployment. `DEC-0058` proves the historical recorded observation, not
the database's current online state.

## Stage A owned files

Edit exactly these five files and no others:

1. `docs/NOW.md`
2. `docs/PROJECT.md`
3. `docs/specs/INDEX.md`
4. `docs/specs/SPEC-BASELINE.md`
5. `docs/governance/DEVELOPMENT-SEQUENCE.md`

Do not create a result file in the repository during Stage A. Report results in
the Qoder response. Codex will inspect the files and prepare the next repository
handoff only after independent acceptance.

## Forbidden scope

- Do not edit any sixth repository file.
- Tool-managed cache directories are excluded from the changed-path manifest;
  do not intentionally edit them or treat them as task output.
- Do not edit approved SPEC bodies or approval JSON files.
- Do not edit task cards, evidence files, handoff files, source, tests,
  templates, migrations, scripts, deployment files, dependencies, or archives.
- Do not access the network, server, service, browser, or database.
- Do not run deployment, migration, restart, import, real-data, commit, push,
  reset, clean, delete, or broad-formatting operations.
- Do not claim TASK-0006, W4, S5, S6, TASK-0002, TASK-0003 capability, or any
  later task is accepted or complete.
- Preserve the existing `SPEC-GOV-0001` draft row in `docs/specs/INDEX.md`.

## Required input SHA-256 baseline

These hashes identify the exact files Codex reviewed before dispatch. Run the
preflight block below before any edit. A mismatch means another write occurred;
stop as `BLOCKED` and do not overwrite it.

| File | Expected SHA-256 |
|---|---|
| `docs/NOW.md` | `5C79634542900A838C27402D40E5614E1942E6EEE1BC6C03EDBE09C4167035A6` |
| `docs/PROJECT.md` | `2E2294BE55A63C33E6FEF66B719F1944AD72570171F47CB7A30738D25B03DD2D` |
| `docs/specs/INDEX.md` | `FF5C9EE1E88DF97649695CC634CCEEDFBA57A38F4E4817C2DB3191993B693FA7` |
| `docs/specs/SPEC-BASELINE.md` | `A0FD6A364055D35BFDEEA6A54772A0206A1B9822529EB7558799128728F92654` |
| `docs/governance/DEVELOPMENT-SEQUENCE.md` | `05DB5E3FEA59BF6A061860EAF49C7B7F58A706E5D7065C6AC7CE2F54F3E78F59` |

## Mandatory preflight command

Run from `D:\Project\中科安樵\crm`. This verifies the owned inputs and records a
temporary whole-repository baseline outside the repository for the changed-path
audit.

```powershell
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$expected = [ordered]@{
  'docs/NOW.md' = '5C79634542900A838C27402D40E5614E1942E6EEE1BC6C03EDBE09C4167035A6'
  'docs/PROJECT.md' = '2E2294BE55A63C33E6FEF66B719F1944AD72570171F47CB7A30738D25B03DD2D'
  'docs/specs/INDEX.md' = 'FF5C9EE1E88DF97649695CC634CCEEDFBA57A38F4E4817C2DB3191993B693FA7'
  'docs/specs/SPEC-BASELINE.md' = 'A0FD6A364055D35BFDEEA6A54772A0206A1B9822529EB7558799128728F92654'
  'docs/governance/DEVELOPMENT-SEQUENCE.md' = '05DB5E3FEA59BF6A061860EAF49C7B7F58A706E5D7065C6AC7CE2F54F3E78F59'
}

foreach ($relative in $expected.Keys) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -ne $expected[$relative]) {
    throw "INPUT HASH MISMATCH: $relative expected=$($expected[$relative]) actual=$actual"
  }
  "INPUT_SHA256 $relative $actual"
}

$excluded = '\\(\.git|\.venv|node_modules|__pycache__|\.playwright-mcp|\.qoder|\.claude|\.cursor|\.pytest_cache)\\'
$baselinePath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-before.json'
$manifest = Get-ChildItem -LiteralPath $root -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch $excluded } |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  }
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $baselinePath -Encoding UTF8
"[PASS] Stage A input hashes match dispatch baseline."
"BASELINE_PATH=$baselinePath"
```

## Exact edit contract

In each of the five owned files, add one concise section titled:

```markdown
## Current adjudication (2026-07-31, TASK-0006)
```

The section must contain these nine lines verbatim:

```markdown
- [VERIFIED] DEC-0058 records that 117 imported records were present in the cloud database on 2026-07-30.
- [VERIFIED] DEC-0059 records the product owner's risk acceptance for the publicly reachable debug service reported at that time.
- [UNKNOWN] TASK-0006 did not access the network; the current online database and service state is unknown.
- [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
- [VERIFIED] TASK-0001 is the explicitly authorized implementation task.
- [NOT VERIFIED] TASK-0002 has incomplete authorization and ownership metadata and is not currently accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable import capability remains unauthorized.
- [VERIFIED] TASK-0006 is a documentation task owned by Qoder and remains HANDOFF-ONLY pending Codex acceptance.
- [PROPOSAL] TASK-0007 through TASK-0011 are PROPOSED/UNAUTHORIZED.
```

Also perform these file-specific mechanical corrections:

### `docs/NOW.md`

- Replace current-state assertions that the database has zero public tables or
  that no service exists.
- Remove wording that treats migration or all real data as still unauthorized.
- Make the opening status consistent with the nine-line adjudication block.
- Do not convert DEC-0058 or DEC-0059 into a current online claim.

### `docs/PROJECT.md`

- Replace the confirmed-facts row claiming the dedicated database remains
  empty and no server migration is authorized.
- Keep historical decisions separate from current runtime status.
- Do not move the unknown online state into the confirmed-facts table as a
  verified runtime observation.

### `docs/specs/INDEX.md`

- Preserve the `SPEC-GOV-0001` draft row and its DRAFT/NOT APPROVED boundary.
- Reconcile task and gate prose without changing approved SPEC bodies or
  approval metadata.
- Do not state that a one-time import completed the reusable SPEC-0013
  capability.

### `docs/specs/SPEC-BASELINE.md`

- Replace current-state prose that says the server database is empty or has no
  migration/permanent object.
- Keep SPEC baseline completion separate from implementation-task acceptance.
- Do not reopen, reapprove, or change the seven approved product SPECs.

### `docs/governance/DEVELOPMENT-SEQUENCE.md`

- Replace `four active implementation tasks` with an accurate task-type and
  authorization description.
- Remove the claim that TASK-0001 through TASK-0003 are all authorized.
- Remove the claim that Qoder has completed TASK-0006 or a revision cycle.
- State that Stage A is in execution and awaits Codex acceptance.
- Keep TASK-0007 through TASK-0011 PROPOSED/UNAUTHORIZED.

Delete or rewrite every conflicting sentence in the five files. Adding the
nine-line block without removing contradictions is a failed Stage A.

## Mandatory post-edit acceptance command

Run this entire block after editing. It must exit zero. Do not paraphrase the
result; include the actual output in the final response.

```powershell
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$owned = @(
  'docs/NOW.md',
  'docs/PROJECT.md',
  'docs/specs/INDEX.md',
  'docs/specs/SPEC-BASELINE.md',
  'docs/governance/DEVELOPMENT-SEQUENCE.md'
)
$expectedBefore = [ordered]@{
  'docs/NOW.md' = '5C79634542900A838C27402D40E5614E1942E6EEE1BC6C03EDBE09C4167035A6'
  'docs/PROJECT.md' = '2E2294BE55A63C33E6FEF66B719F1944AD72570171F47CB7A30738D25B03DD2D'
  'docs/specs/INDEX.md' = 'FF5C9EE1E88DF97649695CC634CCEEDFBA57A38F4E4817C2DB3191993B693FA7'
  'docs/specs/SPEC-BASELINE.md' = 'A0FD6A364055D35BFDEEA6A54772A0206A1B9822529EB7558799128728F92654'
  'docs/governance/DEVELOPMENT-SEQUENCE.md' = '05DB5E3FEA59BF6A061860EAF49C7B7F58A706E5D7065C6AC7CE2F54F3E78F59'
}
$baselinePath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-before.json'
if (-not (Test-Path -LiteralPath $baselinePath)) {
  throw "Missing pre-edit manifest: $baselinePath"
}

$excluded = '\\(\.git|\.venv|node_modules|__pycache__|\.playwright-mcp|\.qoder|\.claude|\.cursor|\.pytest_cache)\\'
$beforeRows = Get-Content -Raw -LiteralPath $baselinePath | ConvertFrom-Json
$afterRows = @(Get-ChildItem -LiteralPath $root -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch $excluded } |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  })

$before = @{}
$after = @{}
foreach ($row in $beforeRows) { $before[$row.Path] = $row.Sha256 }
foreach ($row in $afterRows) { $after[$row.Path] = $row.Sha256 }
$allPaths = @($before.Keys + $after.Keys | Sort-Object -Unique)
$changed = @($allPaths | Where-Object {
  (-not $before.ContainsKey($_)) -or
  (-not $after.ContainsKey($_)) -or
  ($before[$_] -ne $after[$_])
})
$unexpected = @($changed | Where-Object { $_ -notin $owned })
$missingChanges = @($owned | Where-Object { $_ -notin $changed })
if ($unexpected.Count -gt 0) {
  throw "UNAUTHORIZED CHANGED PATHS: $($unexpected -join ', ')"
}
if ($missingChanges.Count -gt 0) {
  throw "REQUIRED TARGETS DID NOT CHANGE: $($missingChanges -join ', ')"
}
"CHANGED_PATHS=$($changed -join ',')"

foreach ($relative in $owned) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -eq $expectedBefore[$relative]) {
    throw "UNCHANGED REQUIRED FILE: $relative"
  }
  "AFTER_SHA256 $relative $actual"
}

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
foreach ($relative in $owned) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $relative).Path)
  foreach ($line in $requiredLines) {
    if (-not $text.Contains($line)) {
      throw "MISSING REQUIRED TEXT in $relative :: $line"
    }
  }
}

$forbidden = @(
  'zero public tables',
  'dedicated database remains empty',
  'no service/release exists',
  'four active implementation tasks',
  'TASK-0001 through TASK-0003 have been authorized',
  'Qoder executed documentation reconciliation',
  'third revision cycle',
  'Applying a migration to the cloud database, real data, release',
  'No application implementation beyond TASK-0003 historical scope'
)
foreach ($relative in $owned) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $relative).Path)
  foreach ($phrase in $forbidden) {
    if ($text.IndexOf($phrase, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      throw "FORBIDDEN STALE CLAIM in $relative :: $phrase"
    }
  }
}

$indexText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/specs/INDEX.md').Path)
if (-not $indexText.Contains('10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md')) {
  throw 'SPEC-GOV-0001 draft row was removed from docs/specs/INDEX.md'
}

Get-ChildItem -LiteralPath 'docs/specs/30-approved' -Filter '*.approval.json' |
  ForEach-Object {
    $meta = [System.IO.File]::ReadAllText($_.FullName) | ConvertFrom-Json
    $specPath = Join-Path $_.DirectoryName $meta.spec_file
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $specPath).Hash.ToLowerInvariant()
    if ($actual -ne $meta.spec_sha256.ToLowerInvariant()) {
      throw "APPROVED SPEC HASH MISMATCH: $specPath"
    }
    "APPROVED_SPEC_SHA256_OK $($meta.spec_id) $actual"
  }

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-governance.ps1
if ($LASTEXITCODE -ne 0) { throw "Governance check failed with exit code $LASTEXITCODE" }

'[PASS] TASK-0006 Stage A mechanical acceptance checks passed.'
```

## Required final response

If and only if the post-edit block exits zero, respond with exactly these
sections and include actual command output, not summaries:

1. `Status: HANDOFF-ONLY / AWAITING CODEX ACCEPTANCE`
2. `Stage: TASK-0006 Stage A only`
3. `Runtime model: <exact identifier>`
4. `Files changed:` exactly the five owned files
5. `Input hashes:` actual preflight output
6. `Changed-path audit:` actual `CHANGED_PATHS` output
7. `After hashes:` actual five `AFTER_SHA256` lines
8. `Acceptance output:` approved-SPEC hash lines, governance output, and final
   Stage A PASS line
9. `Not verified:` current online database/service state; W4/S5/S6 acceptance
10. `Decisions needed: none for Stage A`

Do not say TASK-0006 is complete. Do not say Codex accepted Stage A. Do not
start Stage B.

If any command or requirement fails, respond instead with:

1. `Status: BLOCKED`
2. exact failed command or requirement;
3. exact error output;
4. files changed before the stop;
5. no completion or acceptance claim.

## Next gate

Codex will independently read all five files, rerun the acceptance block, and
issue `ACCEPTED` or `REVISE`. Only an `ACCEPTED` verdict enables Qoder Stage B,
which will be a separate prompt for the uniform historical-evidence header
operation.
