# HANDOFF-20260802-KIMI-TASK-0006-FINAL-BATCH

- Task: `TASK-0006` final consolidated documentation reconciliation
- From: Kimi-K3 on the ZCode agent, coordinator and independent final reviewer
- To: one bounded ZCode subagent dispatched by the coordinator (executor)
- Execution owner: the dispatched ZCode subagent, this batch only
- Acceptance owner: Kimi-K3 (independent, read-only verdict against repository
  file state)
- Authority: `DEC-0062` through `DEC-0066`
- Governance: `SPEC-GOV-0001 v0.3.0` DRAFT, especially `R-002` and
  `R-023` through `R-029`
- Status: HANDOFF-ONLY / FINAL BATCH ASSIGNED
- Written at: 2026-08-02 Asia/Shanghai

## Direct dispatch contract

This file is the complete execution contract. The coordinator dispatches it to
one bounded ZCode subagent. Execute the entire batch in one turn: preflight,
both edit groups, one consolidated acceptance sweep, and one result. Do not
split this batch into more stages or return after only a plan.

If the runtime exposes an exact model identifier, report it verbatim. If it
does not, report `UNKNOWN - runtime identifier not exposed` and continue.
Never guess, infer, or fabricate your model identity; agent names and model
names are distinct and must not be conflated in any record. Runtime metadata
alone is not a reason for another correction loop.

## Required reading

Read before editing:

1. `AGENTS.md` in full.
2. `docs/NOW.md`, `docs/PROJECT.md`, `docs/specs/INDEX.md`, and
   `docs/decisions/DECISION-LOG.md` (at minimum `DEC-0062` through `DEC-0066`).
3. `docs/specs/10-draft/SPEC-GOV-0001-cross-tool-dispatch-and-acceptance.md`.
4. `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`.
5. `docs/evidence/ARCH-20260731-TAKEOVER-REVIEW.md`.
6. `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`.
7. Every owned file below.

Before editing, state the current phase, model identifier or `UNKNOWN`, the
owned paths, assumptions, unknowns, and forbidden scope. Continue immediately.

## Stage A disposition

Codex independently accepted the Stage A repository result before exiting;
that acceptance is historical fact and stands. Do not edit these Stage A files
in this batch:

- `docs/NOW.md`
- `docs/PROJECT.md`
- `docs/specs/INDEX.md`
- `docs/specs/SPEC-BASELINE.md`
- `docs/governance/DEVELOPMENT-SEQUENCE.md`

The last Qoder response had report-format defects, closed as
`PARTIAL / ESCALATED` under `DEC-0065`. Do not retry or repair that response.

## Governing facts

- [VERIFIED] TASK-0001 is the sole explicitly authorized implementation task,
  and its implementation ownership is vacant per `DEC-0066` (no successor
  authorized).
- [VERIFIED] DEC-0053 authorized W4 and DEC-0055 re-authorized W4 after
  recovery.
- [VERIFIED] DEC-0058 records a one-time 117-record import on 2026-07-30.
- [VERIFIED] DEC-0066 records the coordinator/reviewer succession to Kimi-K3
  and assigns this final batch to a ZCode subagent.
- [UNKNOWN] This documentation task did not verify current online service or
  database state.
- [NOT VERIFIED] W4, S5, and S6 do not have accepted gate status.
- [NOT VERIFIED] TASK-0002 authorization/ownership metadata is incomplete and
  authenticated `?q=` filtering is not accepted.
- [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import. Reusable
  SPEC-0013 import capability remains unauthorized and not implemented.
- [VERIFIED] Release, nginx/TLS/DNS, legacy cutover, TASK-0007 through
  TASK-0011, and any new server/database write remain unauthorized.

## Owned paths

Edit exactly these 18 files and no others.

### Group A: task/control reconciliation

1. `docs/tasks/TASKS.md`
2. `docs/tasks/active/TASK-0001-manual-core-record-activity.md`
3. `docs/tasks/active/TASK-0002-search-parameter-rename.md`
4. `docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md`
5. `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`

### Group B: uniform historical-evidence header

6. `docs/evidence/FINAL-REPORT-TASK-0002-0003.md`
7. `docs/evidence/TASK-0002-0003-verification-summary.md`
8. `docs/evidence/TASK-0002-search-parameter-rename.md`
9. `docs/evidence/TASK-0003-bulk-import-suzhou-institutions.md`
10. `docs/evidence/TASK-0006-governance-evidence-matrix.md`
11. `docs/evidence/TASK-0001-S5-FINAL.md`
12. `docs/evidence/TASK-0001-S5-web-layer.md`
13. `docs/evidence/TASK-0001-S5-WEB-LAYER-FIXES.md`
14. `docs/evidence/TASK-0001-S6-local-validation.md`
15. `docs/evidence/TASK-0001-S6-tests.md`
16. `docs/evidence/S6-delivery-summary.md`
17. `docs/evidence/S6-self-verification-checklist.md`
18. `docs/evidence/TASK-0001-W4-database-migration.md`

## Forbidden scope

- Do not edit a 19th repository file.
- Do not edit Stage A files, this handoff, the decision log, governance SPEC,
  approved SPECs, approval JSON, source, tests, templates, migrations, scripts,
  deployment, dependencies, configuration, or archives.
- Do not access the network, server, service, browser, or database.
- Do not deploy, migrate, restart, import, read/write real data, expose secrets,
  commit, push, reset, clean, delete, or broadly reformat.
- Preserve historical evidence bodies. Group B permits only inserting the
  exact uniform header after the first H1 heading.
- Do not claim current online state or accepted W4/S5/S6 gates.
- Do not claim TASK-0006 is accepted or complete. Maximum result status is
  `HANDOFF-ONLY / AWAITING KIMI-K3 FINAL ACCEPTANCE`.
- Do not assert, infer, or fabricate a model identity for yourself or any other
  agent; report an exact runtime identifier or
  `UNKNOWN - runtime identifier not exposed`.

## Required input hashes

```text
docs/tasks/TASKS.md 989D5C3ACDCCA067B29C6060D41A73220B8D61323D1D31235835FE9431F7F016
docs/tasks/active/TASK-0001-manual-core-record-activity.md C8F559318A65B74B2CDEA6EAA645D76A8D276D06BF617C8BC34628630D06A218
docs/tasks/active/TASK-0002-search-parameter-rename.md DED255D7CB593AB1CBB3C3576B9D8BDFB12E99519BE858A05B2F96CD12F8D818
docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md B14A261E22998063B19249841DA5C8BBDA52F135FEEE61E950AC556B5FA1FEFE
docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md DDE5FCBA48336783E0EEA62135EA931B821B6C5B03C6787E3522ACFFF4DDE1BA
docs/evidence/FINAL-REPORT-TASK-0002-0003.md B63BE861B3E145B37BDEF99CCF01A7CEF99DEBB79A654A17BC335B8F73A30C0A
docs/evidence/TASK-0002-0003-verification-summary.md 35A9B5A23639A3E89EAA35F8D0D94A0B4AAE663926997E5A0F49616105D117C2
docs/evidence/TASK-0002-search-parameter-rename.md 62618D352EEB69760C53A02B794CCE6544B131651D34336EE8D9E91B1A184692
docs/evidence/TASK-0003-bulk-import-suzhou-institutions.md 11296056297941F2D13C51B2012EBCEF6F146E6214F142F48D36A29A3CD7FDC1
docs/evidence/TASK-0006-governance-evidence-matrix.md 6657BA8EDA561D2F33B614A1AE7EEC950D685A19527FDFCEB03F762A9AE77D3D
docs/evidence/TASK-0001-S5-FINAL.md F53F04618665774ACE1CEB456C78578F9508783E06AC46AAD6C5025AA92185BE
docs/evidence/TASK-0001-S5-web-layer.md 221ED7FA6DA5B76A15A8F64A8254C6B63F621562BE5365D562E2E399B3254B16
docs/evidence/TASK-0001-S5-WEB-LAYER-FIXES.md 4F859D6EEDF868F3DAE4AD9CA9A01CF94B7C8CA296107968B028862F149407A5
docs/evidence/TASK-0001-S6-local-validation.md 43E5DDF1AE391E4F366C5E288D547DB3C4F3632C92265B0243BA7295A636D9E0
docs/evidence/TASK-0001-S6-tests.md 1EEAA2E015E0EA7ACFA91974424409ED4B4762D434341BB1054BA2376B591FB4
docs/evidence/S6-delivery-summary.md 03C210BB9C7C42230068D3BE40B1BD8CE742F8F550C8E675E53471C09944D2DC
docs/evidence/S6-self-verification-checklist.md 6ED75B616FD1DCEC10D41EA6B97D458536C90D6FC926AEE9DDAD744B8CEFBCD0
docs/evidence/TASK-0001-W4-database-migration.md 669356CA7F4C90B24D4A2C710BE10BB50387B71EF482DFC39379FB99B794CC37
```

## Mandatory preflight

Run from the repository root before editing:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$expected = [ordered]@{
  'docs/tasks/TASKS.md' = '989D5C3ACDCCA067B29C6060D41A73220B8D61323D1D31235835FE9431F7F016'
  'docs/tasks/active/TASK-0001-manual-core-record-activity.md' = 'C8F559318A65B74B2CDEA6EAA645D76A8D276D06BF617C8BC34628630D06A218'
  'docs/tasks/active/TASK-0002-search-parameter-rename.md' = 'DED255D7CB593AB1CBB3C3576B9D8BDFB12E99519BE858A05B2F96CD12F8D818'
  'docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md' = 'B14A261E22998063B19249841DA5C8BBDA52F135FEEE61E950AC556B5FA1FEFE'
  'docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md' = 'DDE5FCBA48336783E0EEA62135EA931B821B6C5B03C6787E3522ACFFF4DDE1BA'
  'docs/evidence/FINAL-REPORT-TASK-0002-0003.md' = 'B63BE861B3E145B37BDEF99CCF01A7CEF99DEBB79A654A17BC335B8F73A30C0A'
  'docs/evidence/TASK-0002-0003-verification-summary.md' = '35A9B5A23639A3E89EAA35F8D0D94A0B4AAE663926997E5A0F49616105D117C2'
  'docs/evidence/TASK-0002-search-parameter-rename.md' = '62618D352EEB69760C53A02B794CCE6544B131651D34336EE8D9E91B1A184692'
  'docs/evidence/TASK-0003-bulk-import-suzhou-institutions.md' = '11296056297941F2D13C51B2012EBCEF6F146E6214F142F48D36A29A3CD7FDC1'
  'docs/evidence/TASK-0006-governance-evidence-matrix.md' = '6657BA8EDA561D2F33B614A1AE7EEC950D685A19527FDFCEB03F762A9AE77D3D'
  'docs/evidence/TASK-0001-S5-FINAL.md' = 'F53F04618665774ACE1CEB456C78578F9508783E06AC46AAD6C5025AA92185BE'
  'docs/evidence/TASK-0001-S5-web-layer.md' = '221ED7FA6DA5B76A15A8F64A8254C6B63F621562BE5365D562E2E399B3254B16'
  'docs/evidence/TASK-0001-S5-WEB-LAYER-FIXES.md' = '4F859D6EEDF868F3DAE4AD9CA9A01CF94B7C8CA296107968B028862F149407A5'
  'docs/evidence/TASK-0001-S6-local-validation.md' = '43E5DDF1AE391E4F366C5E288D547DB3C4F3632C92265B0243BA7295A636D9E0'
  'docs/evidence/TASK-0001-S6-tests.md' = '1EEAA2E015E0EA7ACFA91974424409ED4B4762D434341BB1054BA2376B591FB4'
  'docs/evidence/S6-delivery-summary.md' = '03C210BB9C7C42230068D3BE40B1BD8CE742F8F550C8E675E53471C09944D2DC'
  'docs/evidence/S6-self-verification-checklist.md' = '6ED75B616FD1DCEC10D41EA6B97D458536C90D6FC926AEE9DDAD744B8CEFBCD0'
  'docs/evidence/TASK-0001-W4-database-migration.md' = '669356CA7F4C90B24D4A2C710BE10BB50387B71EF482DFC39379FB99B794CC37'
}
foreach ($relative in $expected.Keys) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash
  if ($actual -cne $expected[$relative]) {
    throw "INPUT HASH MISMATCH: $relative expected=$($expected[$relative]) actual=$actual"
  }
  "INPUT_SHA256 $relative $actual"
}
$excluded = '\\(\.git|\.venv|node_modules|__pycache__|\.playwright-mcp|\.qoder|\.claude|\.cursor|\.pytest_cache)\\'
$baselinePath = Join-Path $env:TEMP 'TASK-0006-FINAL-BATCH-KIMI-before.json'
$manifest = @(Get-ChildItem -LiteralPath $root -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch $excluded } |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
      Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  })
ConvertTo-Json -InputObject $manifest -Depth 3 |
  Set-Content -LiteralPath $baselinePath -Encoding UTF8
'[PASS] TASK-0006 final-batch input hashes and baseline recorded.'
"BASELINE_PATH=$baselinePath"
```

Any input mismatch is a hard blocker. Do not edit after a mismatch.

## Group A exact edit contract

### `docs/tasks/TASKS.md`

- Set `Last updated` to `2026-08-02 (TASK-0006 final reconciliation batch)`.
- TASK-0001: keep TASK-0001 as the sole explicitly authorized implementation
  task; state W4 was authorized under DEC-0053/DEC-0055 but W4/S5/S6 accepted
  gate status remains NOT VERIFIED; state implementation ownership is VACANT
  per DEC-0066 with no successor authorized (historical owner Codex /
  GPT-5.6-sol remains as history).
- TASK-0002: keep authorization/ownership metadata incomplete; local rename is
  historical evidence and authenticated `?q=` filtering remains NOT VERIFIED.
- TASK-0003: state only that DEC-0058 ratified the one-time import; reusable
  capability is not implemented or authorized.
- TASK-0006: state the Stage A repository result was accepted by Codex
  (historical), Codex has exited, Kimi-K3 is coordinator and independent final
  reviewer per DEC-0066, and the final reconciliation batch is executed by a
  ZCode subagent. Remove `PREFLIGHT PENDING`, `Codex is independent reviewer`,
  and `exact runtime model pending self-report` as current status.
- Keep TASK-0007 through TASK-0011 PROPOSED/UNAUTHORIZED and set their
  proposed owner to unassigned per DEC-0066.

### `docs/tasks/active/TASK-0001-manual-core-record-activity.md`

- Correct the top status and authorization metadata:
  - TASK-0001 remains authorized by DEC-0046.
  - Implementation ownership is VACANT per DEC-0066; no successor implementer
    is authorized. Keep the historical owner entry as history.
  - W4 was authorized by DEC-0053 and re-authorized by DEC-0055; formal
    acceptance remains NOT VERIFIED.
  - DEC-0058 ratified one one-time import; this is not reusable capability.
  - Current online database/service state is UNKNOWN.
  - S5/S6 accepted gate status is NOT VERIFIED.
  - Release, nginx/TLS/DNS, and legacy cutover remain unauthorized.
- Replace `no later server write authorized`, `Real-data authorization: NOT
  AUTHORIZED`, and W4 `PENDING` statements wherever they conflict with these
  facts. Preserve historical recovery and execution evidence.
- Do not mark W4, S5, or S6 PASSED.

### `docs/tasks/active/TASK-0002-search-parameter-rename.md`

- Add explicit metadata that implementation authorization and current owner are
  incomplete/unassigned.
- Mark deployment, health, auth-gate, and server observations as historical
  claims from the prior execution, not current runtime proof.
- Keep local parameter rename evidence separate from the unverified
  authenticated `?q=` behavior.
- Do not claim TASK-0002 accepted or complete.

### `docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md`

- Add explicit metadata that current owner/authorization for reusable
  capability is absent.
- Keep DEC-0058 one-time ratification and historical 117-row observation.
- Mark present online database state UNKNOWN.
- Do not authorize or claim reusable SPEC-0013 capability or another import.

### `docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md`

- Reference `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`.
- Record the Stage A repository result as accepted (historical, by Codex) and
  its report defect as closed `PARTIAL / ESCALATED` under DEC-0065.
- Record the succession per DEC-0066: reviewer is Kimi-K3 on the ZCode agent;
  the final batch executor is a ZCode subagent; Qoder's execution of earlier
  stages remains factual history.
- Replace all `Third revision`, all-steps-completed, `AWAITING CODEX` and old
  handoff-only result wording with the current final-batch state.
- At handoff, use exactly:
  `Overall Task Result: HANDOFF-ONLY / AWAITING KIMI-K3 FINAL ACCEPTANCE`.
- Do not mark TASK-0006 complete or accepted.

## Group B uniform edit contract

In each of the 13 Group B files, preserve the entire existing body and insert
exactly one copy of this block immediately after the first H1 heading:

```markdown
> **Current adjudication (2026-08-02, TASK-0006)**
>
> This file is retained as historical execution evidence. Its original observations do not establish current online service/database state or current gate acceptance.
>
> - [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
> - [NOT VERIFIED] TASK-0002 authenticated filtering with `?q=` is not accepted.
> - [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable SPEC-0013 capability remains unauthorized and not implemented.
> - [UNKNOWN] TASK-0006 did not verify the current online database or service state.
> - [AUTHORITY] Current status is governed by `docs/NOW.md`, `docs/tasks/TASKS.md`, and `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`; coordinator/reviewer succession is recorded in `DEC-0066`.
```

Do not rewrite, redact, correct encoding, or normalize the historical body.

## Mandatory consolidated acceptance

Run after both groups are complete:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath '.').Path.TrimEnd('\')
$owned = @(
  'docs/tasks/TASKS.md',
  'docs/tasks/active/TASK-0001-manual-core-record-activity.md',
  'docs/tasks/active/TASK-0002-search-parameter-rename.md',
  'docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md',
  'docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md',
  'docs/evidence/FINAL-REPORT-TASK-0002-0003.md',
  'docs/evidence/TASK-0002-0003-verification-summary.md',
  'docs/evidence/TASK-0002-search-parameter-rename.md',
  'docs/evidence/TASK-0003-bulk-import-suzhou-institutions.md',
  'docs/evidence/TASK-0006-governance-evidence-matrix.md',
  'docs/evidence/TASK-0001-S5-FINAL.md',
  'docs/evidence/TASK-0001-S5-web-layer.md',
  'docs/evidence/TASK-0001-S5-WEB-LAYER-FIXES.md',
  'docs/evidence/TASK-0001-S6-local-validation.md',
  'docs/evidence/TASK-0001-S6-tests.md',
  'docs/evidence/S6-delivery-summary.md',
  'docs/evidence/S6-self-verification-checklist.md',
  'docs/evidence/TASK-0001-W4-database-migration.md'
)
$evidenceFiles = $owned | Where-Object { $_ -like 'docs/evidence/*' }
$baselinePath = Join-Path $env:TEMP 'TASK-0006-FINAL-BATCH-KIMI-before.json'
if (-not (Test-Path -LiteralPath $baselinePath)) { throw "MISSING BASELINE: $baselinePath" }
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
$before=@{}; $after=@{}
foreach($row in $beforeRows){$before[$row.Path]=$row.Sha256}
foreach($row in $afterRows){$after[$row.Path]=$row.Sha256}
$all=@($before.Keys)+@($after.Keys) | Sort-Object -Unique
$changed=@($all | Where-Object {(-not $before.ContainsKey($_))-or(-not $after.ContainsKey($_))-or($before[$_] -cne $after[$_])})
$unexpected=@($changed | Where-Object {$_ -notin $owned})
$missing=@($owned | Where-Object {$_ -notin $changed})
if($unexpected.Count){throw "UNAUTHORIZED CHANGED PATHS: $($unexpected -join ', ')"}
if($missing.Count){throw "REQUIRED TARGETS DID NOT CHANGE: $($missing -join ', ')"}
if($changed.Count -ne 18){throw "EXPECTED 18 CHANGED PATHS, ACTUAL=$($changed.Count)"}
"CHANGED_PATHS=$($changed -join ',')"

$header='> **Current adjudication (2026-08-02, TASK-0006)**'
$headerRequired=@(
  '> - [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.',
  '> - [NOT VERIFIED] TASK-0002 authenticated filtering with `?q=` is not accepted.',
  "> - [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable SPEC-0013 capability remains unauthorized and not implemented.",
  '> - [UNKNOWN] TASK-0006 did not verify the current online database or service state.',
  '> - [AUTHORITY] Current status is governed by `docs/NOW.md`, `docs/tasks/TASKS.md`, and `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`; coordinator/reviewer succession is recorded in `DEC-0066`.'
)
foreach($relative in $evidenceFiles){
  $text=[IO.File]::ReadAllText((Resolve-Path -LiteralPath $relative).Path)
  if([regex]::Matches($text,[regex]::Escape($header)).Count -ne 1){throw "HEADER COUNT FAILED: $relative"}
  foreach($line in $headerRequired){if(-not $text.Contains($line)){throw "HEADER LINE MISSING: $relative :: $line"}}
}

$tasks=[IO.File]::ReadAllText((Resolve-Path 'docs/tasks/TASKS.md').Path)
foreach($required in @(
  'Last updated: 2026-08-02 (TASK-0006 final reconciliation batch)',
  'Stage A repository result accepted',
  'W4/S5/S6',
  'NOT VERIFIED',
  'DEC-0066',
  'TASK-0007 through TASK-0011'
)){if(-not $tasks.Contains($required)){throw "TASKS.md REQUIRED TEXT MISSING: $required"}}

$task1=[IO.File]::ReadAllText((Resolve-Path 'docs/tasks/active/TASK-0001-manual-core-record-activity.md').Path)
foreach($required in @('DEC-0053','DEC-0055','DEC-0058','DEC-0066','W4','VACANT','NOT VERIFIED','UNKNOWN')){if(-not $task1.Contains($required)){throw "TASK-0001 REQUIRED TEXT MISSING: $required"}}
$task2=[IO.File]::ReadAllText((Resolve-Path 'docs/tasks/active/TASK-0002-search-parameter-rename.md').Path)
foreach($required in @('Implementation authorized by: NOT VERIFIED','Owner: Unassigned','authenticated','?q=','NOT VERIFIED')){if(-not $task2.Contains($required)){throw "TASK-0002 REQUIRED TEXT MISSING: $required"}}
$task3=[IO.File]::ReadAllText((Resolve-Path 'docs/tasks/active/TASK-0003-bulk-import-suzhou-institutions.md').Path)
foreach($required in @('DEC-0058','one-time','reusable','NOT AUTHORIZED','UNKNOWN')){if(-not $task3.Contains($required)){throw "TASK-0003 REQUIRED TEXT MISSING: $required"}}
$task6=[IO.File]::ReadAllText((Resolve-Path 'docs/tasks/active/TASK-0006-governance-evidence-reconciliation.md').Path)
foreach($required in @('TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md','PARTIAL / ESCALATED','DEC-0066','Overall Task Result: HANDOFF-ONLY / AWAITING KIMI-K3 FINAL ACCEPTANCE')){if(-not $task6.Contains($required)){throw "TASK-0006 REQUIRED TEXT MISSING: $required"}}
foreach($forbidden in @('Third revision','PREFLIGHT PENDING','exact runtime model pending self-report','Codex is independent reviewer','AWAITING CODEX')){if($tasks.IndexOf($forbidden,[StringComparison]::OrdinalIgnoreCase)-ge 0 -or $task6.IndexOf($forbidden,[StringComparison]::OrdinalIgnoreCase)-ge 0){throw "FORBIDDEN CURRENT TASK TEXT: $forbidden"}}
if($tasks.IndexOf('Codex / GPT-5',[StringComparison]::OrdinalIgnoreCase)-ge 0){throw "FORBIDDEN CURRENT TASK TEXT: Codex / GPT-5 in TASKS.md"}

Get-ChildItem -LiteralPath 'docs/specs/30-approved' -Filter '*.approval.json' | ForEach-Object {
  $meta=[IO.File]::ReadAllText($_.FullName)|ConvertFrom-Json
  $specPath=Join-Path $_.DirectoryName $meta.spec_file
  $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $specPath).Hash.ToLowerInvariant()
  if($actual -cne $meta.spec_sha256.ToLowerInvariant()){throw "APPROVED SPEC HASH MISMATCH: $specPath"}
  "APPROVED_SPEC_SHA256_OK $($meta.spec_id) $actual"
}
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-governance.ps1
if($LASTEXITCODE -ne 0){throw "Governance check failed: $LASTEXITCODE"}
foreach($relative in $owned){"AFTER_SHA256 $relative $((Get-FileHash -Algorithm SHA256 -LiteralPath $relative).Hash)"}
'[PASS] TASK-0006 final consolidated batch checks passed.'
```

## Required result

If the acceptance block passes, return one concise result containing:

1. `Status: HANDOFF-ONLY / AWAITING KIMI-K3 FINAL ACCEPTANCE`
2. `Runtime model: <exact identifier or UNKNOWN - runtime identifier not exposed>`
3. `Files changed: 18 owned files`
4. Actual `CHANGED_PATHS=` output
5. Actual 18 `AFTER_SHA256` lines
6. Seven approved-SPEC hash lines, governance output, and final PASS line
7. `Not verified: current online database/service state; W4/S5/S6 acceptance`
8. `Decisions needed: none for TASK-0006 final documentation batch`

If any preflight or acceptance check fails, return `Status: PARTIAL / ESCALATED`
with the exact failed check, output, and files changed. Do not create another
handoff, do not self-correct outside the owned set, and do not claim completion.
