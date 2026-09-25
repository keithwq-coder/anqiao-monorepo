# HANDOFF-20260801-CODEX-QODER-TASK-0006-STAGE-A-REVISE

- Task: `TASK-0006` Stage A revision, canonical control-document reconciliation
- From tool/model: Codex / GPT-5, coordinator and independent reviewer
- To tool/model: Qoder / exact runtime model must be self-reported
- Execution owner: Qoder
- Reviewer and acceptance owner: Codex
- Authority: `DEC-0062`, `DEC-0063`, and `DEC-0064`
- Handoff status: HANDOFF-ONLY / STAGE A REVISE ASSIGNED
- Repository state: `main` has no commits and current files are untracked
- Written at: 2026-08-01 Asia/Shanghai

## Transport contract

This file is the complete execution prompt. The product owner only transports
it. Do not ask the product owner to interpret the prior Codex verdict, choose
commands, merge context, or explain what must change.

Execute this prompt end to end in the same Qoder turn. Do not stop after a plan
or preflight. Stop only on a hard blocker or failed check, and then report
`BLOCKED` with the exact error. Do not start Stage B.

## Required reading before editing

Read these files from the repository, not from chat memory:

1. `AGENTS.md` in full.
2. `QODER.md`.
3. `docs/NOW.md`.
4. `docs/PROJECT.md`.
5. `docs/specs/INDEX.md`.
6. `docs/decisions/DECISION-LOG.md`, especially `DEC-0053`, `DEC-0055`,
   `DEC-0058`, `DEC-0059`, `DEC-0062`, `DEC-0063`, and `DEC-0064`.
7. `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md`.
8. `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`.
9. `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`.
10. Every owned file listed below.

Before editing, state the current phase, exact runtime model, assumptions,
unknowns, owned files, and forbidden scope. Then continue immediately.

## Current phase and reviewer evidence

Current phase: `TASK-0006 Stage A - REVISE`. The prior Stage A result is not
accepted. Qoder remains execution owner; Codex remains independent reviewer.

The prior result passed the required nine-line text check, approved-SPEC hash
check, and governance check. Preserve those passing conditions.

The prior result failed for two independently observed reasons:

1. The persisted pre-edit manifest did not contain `.gitattributes` or
   `.gitignore`, so the changed-path gate later reported them as unexpected.
   This revision uses a new manifest and explicitly verifies those two
   sentinel paths before editing.
2. The five owned files still contain stale semantic variants that evaded the
   narrow forbidden-string check:
   - `docs/NOW.md`: `ensured no public tables remain`;
   - `docs/NOW.md`: `Applying a migration to the cloud database for real data tier`;
   - `docs/NOW.md`: `No public tables exist within the synthetic-data build scope`;
   - `docs/PROJECT.md`: `the dedicated database has no public tables`;
   - `docs/specs/SPEC-BASELINE.md`: `server has an empty dedicated database`;
   - `docs/specs/SPEC-BASELINE.md`: `no business behavior, migration, permanent database object or release`.

`DEC-0053` authorized W4 and superseded the W4/G5 `PENDING / not authorized`
state. `DEC-0055` re-authorized W4 after recovery. `DEC-0058` records a later
one-time 117-record import. TASK-0006 did not access the network, so current
online database and service state remains unknown. Historical execution and
current gate acceptance must remain separate.

## Owned files

Edit exactly these five files and no others:

1. `docs/NOW.md`
2. `docs/PROJECT.md`
3. `docs/specs/INDEX.md`
4. `docs/specs/SPEC-BASELINE.md`
5. `docs/governance/DEVELOPMENT-SEQUENCE.md`

Do not create a result file in the repository. Report results in the Qoder
response for the product owner to transport back to Codex.

## Forbidden scope

- Do not edit a sixth repository file.
- Do not edit this handoff, the decision log, the governance SPEC draft,
  approved SPEC bodies, approval JSON, task cards, evidence files, source,
  tests, templates, migrations, scripts, deployment files, dependencies, or
  archives.
- Do not access the network, server, service, browser, or database.
- Do not deploy, migrate, restart, import, read/write real data, commit, push,
  reset, clean, delete, or broadly format files.
- Do not claim TASK-0006, Stage A, W4, S5, S6, TASK-0002, reusable TASK-0003
  capability, or any later task is accepted or complete.
- Preserve the `SPEC-GOV-0001` draft row and its DRAFT / NOT APPROVED boundary.

## Required input SHA-256 baseline

| File | Expected SHA-256 |
|---|---|
| `docs/NOW.md` | `79FE583C5874771D73624F3DD3A602F205501AD5A05B363E798E093C23C13AB8` |
| `docs/PROJECT.md` | `9D3B0CD9B671B212E65860F3B379E0D0DB8D56BB972F87DAB3A240AAF55A41A9` |
| `docs/specs/INDEX.md` | `CAE386132FDA11E229E1CFFBEA8750F1DD9B5E1AEADAEB94FFC38B284D4389D0` |
| `docs/specs/SPEC-BASELINE.md` | `87D946537B0F72825E370B52FA342C5897ECAE75B0909D43EE5046F01722447A` |
| `docs/governance/DEVELOPMENT-SEQUENCE.md` | `E64ABFD05E30D4B2D3CA5FD7FBC4698F42C328BB5F82A7CC8642D0A90E113432` |

## Mandatory preflight

Run from `D:\Project\中科安樵\crm` before editing:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$expected = [ordered]@{
  'docs/NOW.md' = '79FE583C5874771D73624F3DD3A602F205501AD5A05B363E798E093C23C13AB8'
  'docs/PROJECT.md' = '9D3B0CD9B671B212E65860F3B379E0D0DB8D56BB972F87DAB3A240AAF55A41A9'
  'docs/specs/INDEX.md' = 'CAE386132FDA11E229E1CFFBEA8750F1DD9B5E1AEADAEB94FFC38B284D4389D0'
  'docs/specs/SPEC-BASELINE.md' = '87D946537B0F72825E370B52FA342C5897ECAE75B0909D43EE5046F01722447A'
  'docs/governance/DEVELOPMENT-SEQUENCE.md' = 'E64ABFD05E30D4B2D3CA5FD7FBC4698F42C328BB5F82A7CC8642D0A90E113432'
}
foreach ($relative in $expected.Keys) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -cne $expected[$relative]) {
    throw "INPUT HASH MISMATCH: $relative expected=$($expected[$relative]) actual=$actual"
  }
  "INPUT_SHA256 $relative $actual"
}

$excluded = '\\(\.git|\.venv|node_modules|__pycache__|\.playwright-mcp|\.qoder|\.claude|\.cursor|\.pytest_cache)\\'
$baselinePath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-REVISE-before.json'
$manifest = @(Get-ChildItem -LiteralPath $root -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch $excluded } |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  })
foreach ($sentinel in @('.gitattributes', '.gitignore')) {
  if ($sentinel -notin @($manifest.Path)) {
    throw "BASELINE SENTINEL MISSING: $sentinel"
  }
  "BASELINE_SENTINEL_OK $sentinel"
}
ConvertTo-Json -InputObject $manifest -Depth 3 |
  Set-Content -LiteralPath $baselinePath -Encoding UTF8
"[PASS] Stage A revision input hashes and repository baseline recorded."
"BASELINE_PATH=$baselinePath"
```

Any mismatch or missing sentinel is a hard blocker. Do not edit after failure.

## Exact edit contract

Preserve exactly one copy of the existing section titled:

```markdown
## Current adjudication (2026-07-31, TASK-0006)
```

Preserve all nine existing adjudication lines verbatim in every owned file.

Apply these corrections:

### `docs/NOW.md`

- Remove every current-state claim that the database has no public tables or is
  empty.
- Remove wording that says W4 migration remains unauthorized.
- State historical sequencing: GR1 returned the database to its recorded empty
  recovery state; `DEC-0053` authorized W4; `DEC-0055` re-authorized W4;
  `DEC-0058` later recorded the one-time 117-record import.
- Add this exact sentence to the opening status:
  `W4 was authorized under DEC-0053 and re-authorized under DEC-0055; its formal acceptance remains NOT VERIFIED.`
- Keep release, nginx/TLS/DNS, and legacy cutover unauthorized. Do not group
  those boundaries with W4 or the ratified one-time import.
- Do not claim the service or database is currently online or offline.

### `docs/PROJECT.md`

- Replace the confirmed-facts row containing `the dedicated database has no public tables`.
- The replacement must state that TASK-0001 is explicitly authorized, W4/S5/S6
  do not have accepted gate status, and TASK-0006 did not verify current online
  database/service state.
- Do not place an empty-database observation in the confirmed-facts table.

### `docs/specs/INDEX.md`

- Change `Last updated` to `2026-08-01 (TASK-0006 Stage A revision)`.
- Preserve all seven approved SPEC rows, approval boundaries, the nine-line
  adjudication block, and the `SPEC-GOV-0001` draft row.
- Add this exact sentence after the adjudication block:
  `Stage A remains unaccepted until Codex independently accepts both the changed-path and semantic checks.`
- Do not imply the one-time import completed reusable SPEC-0013 capability.

### `docs/specs/SPEC-BASELINE.md`

- Replace the current-state bullet saying the server database is empty and has
  no migration or permanent database object.
- State only the accepted task/gate evidence, the historical DEC-0058
  observation, the unknown current online state, and the unaccepted W4/S5/S6
  gates.
- Keep baseline completion separate from implementation and gate acceptance.

### `docs/governance/DEVELOPMENT-SEQUENCE.md`

- Change the Stage A wording to say the Stage A revision is in execution and
  remains HANDOFF-ONLY pending Codex acceptance.
- Add or replace with this exact sentence:
  `[TASK-0006 DOCUMENTATION] Stage A revision is in execution under DEC-0062 through DEC-0064 and remains HANDOFF-ONLY pending Codex acceptance.`
- Keep TASK-0001 as the sole explicitly authorized implementation task.
- Keep TASK-0007 through TASK-0011 PROPOSED/UNAUTHORIZED.

Delete or rewrite every conflicting sentence. Word substitution that preserves
the same stale meaning is a failed revision.

## Mandatory post-edit acceptance

Run this entire block after editing:

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
$expectedBefore = [ordered]@{
  'docs/NOW.md' = '79FE583C5874771D73624F3DD3A602F205501AD5A05B363E798E093C23C13AB8'
  'docs/PROJECT.md' = '9D3B0CD9B671B212E65860F3B379E0D0DB8D56BB972F87DAB3A240AAF55A41A9'
  'docs/specs/INDEX.md' = 'CAE386132FDA11E229E1CFFBEA8750F1DD9B5E1AEADAEB94FFC38B284D4389D0'
  'docs/specs/SPEC-BASELINE.md' = '87D946537B0F72825E370B52FA342C5897ECAE75B0909D43EE5046F01722447A'
  'docs/governance/DEVELOPMENT-SEQUENCE.md' = 'E64ABFD05E30D4B2D3CA5FD7FBC4698F42C328BB5F82A7CC8642D0A90E113432'
}
$baselinePath = Join-Path $env:TEMP 'TASK-0006-STAGE-A-REVISE-before.json'
if (-not (Test-Path -LiteralPath $baselinePath)) {
  throw "Missing pre-edit manifest: $baselinePath"
}

$excluded = '\\(\.git|\.venv|node_modules|__pycache__|\.playwright-mcp|\.qoder|\.claude|\.cursor|\.pytest_cache)\\'
$beforeRows = Get-Content -Raw -Encoding UTF8 -LiteralPath $baselinePath | ConvertFrom-Json
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
$allPaths = @($before.Keys) + @($after.Keys)
$allPaths = @($allPaths | Sort-Object -Unique)
$changed = @($allPaths | Where-Object {
  (-not $before.ContainsKey($_)) -or
  (-not $after.ContainsKey($_)) -or
  ($before[$_] -cne $after[$_])
})
$unexpected = @($changed | Where-Object { $_ -notin $owned })
$missingChanges = @($owned | Where-Object { $_ -notin $changed })
if ($unexpected.Count -gt 0) {
  throw "UNAUTHORIZED CHANGED PATHS: $($unexpected -join ', ')"
}
if ($missingChanges.Count -gt 0) {
  throw "REQUIRED TARGETS DID NOT CHANGE: $($missingChanges -join ', ')"
}
if ($changed.Count -ne 5) {
  throw "EXPECTED EXACTLY 5 CHANGED PATHS, ACTUAL=$($changed.Count)"
}
"CHANGED_PATHS=$($changed -join ',')"

foreach ($relative in $owned) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -ceq $expectedBefore[$relative]) {
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
  if ([regex]::Matches($text, [regex]::Escape($requiredLines[0])).Count -ne 1) {
    throw "ADJUDICATION HEADING COUNT IS NOT ONE: $relative"
  }
}

$forbidden = @(
  'zero public tables',
  'no public tables',
  'dedicated database remains empty',
  'empty dedicated database',
  'no service/release exists',
  'Applying a migration to the cloud database for real data tier',
  'no business behavior',
  'permanent database object',
  'four active implementation tasks',
  'TASK-0001 through TASK-0003 have been authorized',
  'Qoder executed documentation reconciliation',
  'third revision cycle'
)
foreach ($relative in $owned) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $relative).Path)
  foreach ($phrase in $forbidden) {
    if ($text.IndexOf($phrase, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
      throw "FORBIDDEN STALE CLAIM in $relative :: $phrase"
    }
  }
}

$nowText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/NOW.md').Path)
if (-not $nowText.Contains('W4 was authorized under DEC-0053 and re-authorized under DEC-0055; its formal acceptance remains NOT VERIFIED.')) {
  throw 'NOW.md is missing the required W4 authorization/acceptance boundary'
}
$indexText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/specs/INDEX.md').Path)
if (-not $indexText.Contains('Last updated: 2026-08-01 (TASK-0006 Stage A revision)')) {
  throw 'INDEX.md last-updated marker is missing'
}
if (-not $indexText.Contains('Stage A remains unaccepted until Codex independently accepts both the changed-path and semantic checks.')) {
  throw 'INDEX.md Stage A acceptance boundary is missing'
}
if (-not $indexText.Contains('10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md')) {
  throw 'SPEC-GOV-0001 draft row was removed from INDEX.md'
}
$sequenceText = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath 'docs/governance/DEVELOPMENT-SEQUENCE.md').Path)
if (-not $sequenceText.Contains('[TASK-0006 DOCUMENTATION] Stage A revision is in execution under DEC-0062 through DEC-0064 and remains HANDOFF-ONLY pending Codex acceptance.')) {
  throw 'DEVELOPMENT-SEQUENCE.md revision-state sentence is missing'
}

Get-ChildItem -LiteralPath 'docs/specs/30-approved' -Filter '*.approval.json' |
  ForEach-Object {
    $meta = [System.IO.File]::ReadAllText($_.FullName) | ConvertFrom-Json
    $specPath = Join-Path $_.DirectoryName $meta.spec_file
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $specPath).Hash.ToLowerInvariant()
    if ($actual -cne $meta.spec_sha256.ToLowerInvariant()) {
      throw "APPROVED SPEC HASH MISMATCH: $specPath"
    }
    "APPROVED_SPEC_SHA256_OK $($meta.spec_id) $actual"
  }

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-governance.ps1
if ($LASTEXITCODE -ne 0) {
  throw "Governance check failed with exit code $LASTEXITCODE"
}
'[PASS] TASK-0006 Stage A revision mechanical and semantic checks passed.'
```

## Required response

If every check passes, respond with exactly these sections and actual output:

1. `Status: HANDOFF-ONLY / AWAITING CODEX ACCEPTANCE`
2. `Stage: TASK-0006 Stage A revision only`
3. `Runtime model: <exact identifier>`
4. `Files changed:` exactly the five owned files
5. `Input hashes:` all five `INPUT_SHA256` lines
6. `Baseline sentinels:` both `BASELINE_SENTINEL_OK` lines
7. `Changed-path audit:` the actual `CHANGED_PATHS` line
8. `After hashes:` all five `AFTER_SHA256` lines
9. `Acceptance output:` seven approved-SPEC hash lines, governance output, and
   the final Stage A revision PASS line
10. `Not verified:` current online database/service state; W4/S5/S6 acceptance
11. `Decisions needed: none for Stage A revision`

Do not say TASK-0006 or Stage A is complete or accepted. Do not start Stage B.

If a preflight, edit requirement, or post-edit check fails, respond instead:

1. `Status: BLOCKED`
2. exact failed command or requirement
3. exact error output
4. files changed before the stop
5. no completion or acceptance claim

## Next gate

The product owner will transport the Qoder response back to Codex. Codex will
independently rerun the checks and issue either `ACCEPTED` or another complete
copy-ready revision prompt. Only `ACCEPTED` enables Stage B.
