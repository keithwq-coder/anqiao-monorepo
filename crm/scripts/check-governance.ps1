[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$errors = [System.Collections.Generic.List[string]]::new()
$notes = [System.Collections.Generic.List[string]]::new()

function Add-CheckError {
    param([Parameter(Mandatory)][string]$Message)
    $errors.Add($Message)
}

function Get-RepoPath {
    param([Parameter(Mandatory)][string]$RelativePath)
    return [System.IO.Path]::GetFullPath(
        (Join-Path $root ($RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
    )
}

function Test-IsInside {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Parent
    )

    $normalizedParent = $Parent.TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ) + [System.IO.Path]::DirectorySeparatorChar

    return $Path.StartsWith($normalizedParent, [System.StringComparison]::OrdinalIgnoreCase)
}

$requiredPaths = @(
    'AGENTS.md',
    'CLAUDE.md',
    'QODER.md',
    'ZCODE.md',
    '.cursor/rules/00-project-governance.mdc',
    'docs/NOW.md',
    'docs/PROJECT.md',
    'docs/decisions/DECISION-LOG.md',
    'docs/governance/DEVELOPMENT-SEQUENCE.md',
    'docs/specs/INDEX.md',
    'docs/specs/SPEC-BASELINE.md',
    'docs/specs/30-approved/README.md',
    'docs/specs/99-legacy/2026-07-26-crm-system/MIGRATION-NOTE.md',
    'docs/specs/99-legacy/2026-07-26-crm-system/manifest.json',
    'docs/tasks/TASKS.md',
    'docs/tasks/active/README.md'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Get-RepoPath $relativePath))) {
        Add-CheckError "Missing required path: $relativePath"
    }
}

$adapters = @(
    'CLAUDE.md',
    'QODER.md',
    'ZCODE.md',
    '.cursor/rules/00-project-governance.mdc'
)

foreach ($adapter in $adapters) {
    $adapterPath = Get-RepoPath $adapter
    if (Test-Path -LiteralPath $adapterPath) {
        $adapterText = Get-Content -Raw -Encoding UTF8 -LiteralPath $adapterPath
        if ($adapterText -notmatch 'AGENTS\.md') {
            Add-CheckError "Tool adapter does not point to AGENTS.md: $adapter"
        }
    }
}

$approvedRoot = Get-RepoPath 'docs/specs/30-approved'
$approvedSpecs = @(
    Get-ChildItem -File -Filter '*.md' -LiteralPath $approvedRoot -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'README.md' }
)

foreach ($spec in $approvedSpecs) {
    $approvalName = [System.IO.Path]::GetFileNameWithoutExtension($spec.Name) + '.approval.json'
    $approvalPath = Join-Path $spec.DirectoryName $approvalName

    if (-not (Test-Path -LiteralPath $approvalPath)) {
        Add-CheckError "Approved SPEC has no approval metadata: $($spec.Name)"
        continue
    }

    try {
        $approval = Get-Content -Raw -Encoding UTF8 -LiteralPath $approvalPath | ConvertFrom-Json
    }
    catch {
        Add-CheckError "Invalid approval JSON $approvalName`: $($_.Exception.Message)"
        continue
    }

    $requiredApprovalFields = @(
        'spec_id',
        'spec_version',
        'status',
        'approved_by',
        'approved_at',
        'approval_evidence',
        'spec_file',
        'spec_sha256'
    )
    $fieldNames = @($approval.PSObject.Properties.Name)
    $missingFields = @($requiredApprovalFields | Where-Object { $_ -notin $fieldNames })
    if ($missingFields.Count -gt 0) {
        Add-CheckError "Approval metadata $approvalName is missing: $($missingFields -join ', ')"
        continue
    }

    if ([string]$approval.status -cne 'approved') {
        Add-CheckError "Approval status must be exactly 'approved': $approvalName"
    }
    if ([string]$approval.approved_by -cne 'product-owner') {
        Add-CheckError "approved_by must be exactly 'product-owner': $approvalName"
    }
    if ([string]$approval.spec_file -cne $spec.Name) {
        Add-CheckError "spec_file does not match $($spec.Name): $approvalName"
    }
    if ([string]::IsNullOrWhiteSpace([string]$approval.approval_evidence)) {
        Add-CheckError "approval_evidence must not be empty: $approvalName"
    }
    $approvalDate = [datetime]::MinValue
    if (-not [datetime]::TryParseExact(
        [string]$approval.approved_at,
        'yyyy-MM-dd',
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::None,
        [ref]$approvalDate
    )) {
        Add-CheckError "approved_at must use YYYY-MM-DD: $approvalName"
    }
    if ([string]$approval.spec_sha256 -notmatch '^[0-9a-f]{64}$') {
        Add-CheckError "spec_sha256 is not lowercase SHA-256: $approvalName"
    }
    else {
        $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $spec.FullName).Hash.ToLowerInvariant()
        if ($actualHash -cne [string]$approval.spec_sha256) {
            Add-CheckError "Approved SPEC hash mismatch (content changed after approval): $($spec.Name)"
        }
    }

    $specText = Get-Content -Raw -Encoding UTF8 -LiteralPath $spec.FullName
    $specIdMatch = [regex]::Match($specText, '(?m)^- Spec ID:\s*(\S+)\s*$')
    if (-not $specIdMatch.Success) {
        Add-CheckError "Approved SPEC is missing a Spec ID field: $($spec.Name)"
    }
    elseif ($specIdMatch.Groups[1].Value -cne [string]$approval.spec_id) {
        Add-CheckError "SPEC id does not match approval metadata: $($spec.Name)"
    }
    $specVersionMatch = [regex]::Match($specText, '(?m)^- Version:\s*(\S+)\s*$')
    if (-not $specVersionMatch.Success) {
        Add-CheckError "Approved SPEC is missing a Version field: $($spec.Name)"
    }
    elseif ($specVersionMatch.Groups[1].Value -cne [string]$approval.spec_version) {
        Add-CheckError "SPEC version does not match approval metadata: $($spec.Name)"
    }
    if ($specText -notmatch '(?m)^- Status:\s*APPROVED\s*$') {
        Add-CheckError "Approved SPEC status line must be 'Status: APPROVED': $($spec.Name)"
    }
    if ($specText -match '(?i)\b(TBD|TODO)\b|待填写|NOT APPROVED') {
        Add-CheckError "Approved SPEC still contains a blocking placeholder: $($spec.Name)"
    }
}

$activeRoot = Get-RepoPath 'docs/tasks/active'
$activeTasks = @(
    Get-ChildItem -File -Filter '*.md' -LiteralPath $activeRoot -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'README.md' }
)

$baselinePath = Get-RepoPath 'docs/specs/SPEC-BASELINE.md'
if (Test-Path -LiteralPath $baselinePath -PathType Leaf) {
    $baselineText = Get-Content -Raw -Encoding UTF8 -LiteralPath $baselinePath
    $baselineComplete = $baselineText -match '(?m)^- Status:\s*COMPLETE\s*$'
    if ($activeTasks.Count -gt 0 -and -not $baselineComplete) {
        Add-CheckError 'Active tasks are forbidden while the complete SPEC baseline is not COMPLETE'
    }
}

foreach ($task in $activeTasks) {
    $taskText = Get-Content -Raw -Encoding UTF8 -LiteralPath $task.FullName
    if ($taskText -match 'docs/specs/99-legacy') {
        Add-CheckError "Active task references legacy material as authority: $($task.Name)"
    }
    if ($taskText -match '(?im)^-\s*(Deadline|Due date|ETA|Timeline|Duration estimate|Effort estimate|Sprint commitment|工期|截止日期|预计完成时间|预计工时)\s*:') {
        Add-CheckError "Active task contains a time-based planning field: $($task.Name)"
    }
    if ($taskText -notmatch '(?m)^- Depends on:\s*.+$') {
        Add-CheckError "Active task has no dependency field: $($task.Name)"
    }
    if ($taskText -notmatch '(?m)^## Prerequisites and completion gate\s*$') {
        Add-CheckError "Active task has no prerequisites/completion gate section: $($task.Name)"
    }

    $specMatch = [regex]::Match($taskText, 'Approved SPEC:\s*`([^`]+)`')
    if (-not $specMatch.Success) {
        Add-CheckError "Active task has no parseable Approved SPEC field: $($task.Name)"
    }
    else {
        $taskSpecPath = Get-RepoPath $specMatch.Groups[1].Value
        if (-not (Test-IsInside -Path $taskSpecPath -Parent $approvedRoot)) {
            Add-CheckError "Active task points outside the approved SPEC directory: $($task.Name)"
        }
        elseif (-not (Test-Path -LiteralPath $taskSpecPath)) {
            Add-CheckError "Active task points to a missing approved SPEC: $($task.Name)"
        }
    }

    $approvalMatch = [regex]::Match($taskText, 'Approval metadata:\s*`([^`]+)`')
    if (-not $approvalMatch.Success) {
        Add-CheckError "Active task has no parseable Approval metadata field: $($task.Name)"
    }
    else {
        $taskApprovalPath = Get-RepoPath $approvalMatch.Groups[1].Value
        if (-not (Test-IsInside -Path $taskApprovalPath -Parent $approvedRoot)) {
            Add-CheckError "Active task approval metadata points outside the approved SPEC directory: $($task.Name)"
        }
        elseif (-not (Test-Path -LiteralPath $taskApprovalPath -PathType Leaf)) {
            Add-CheckError "Active task points to missing approval metadata: $($task.Name)"
        }
    }

    if ($taskText -match '(?m)^- Status:\s*ACTIVE\s*$' -and
        $taskText -match '(?m)^- Task type:\s*IMPLEMENTATION\s*$' -and
        $taskText -match '(?m)^- Implementation authorized by:\s*NOT AUTHORIZED\s*$') {
        Add-CheckError "Active implementation task has no recorded authorization: $($task.Name)"
    }
}

$legacyRoot = Get-RepoPath 'docs/specs/99-legacy'
$legacySnapshots = @(
    Get-ChildItem -Directory -LiteralPath $legacyRoot -ErrorAction SilentlyContinue
)
foreach ($snapshot in $legacySnapshots) {
    if (-not (Test-Path -LiteralPath (Join-Path $snapshot.FullName 'manifest.json') -PathType Leaf)) {
        Add-CheckError "Legacy snapshot has no manifest.json: $($snapshot.Name)"
    }
}

$manifests = @(
    Get-ChildItem -File -Filter 'manifest.json' -Recurse -LiteralPath $legacyRoot -ErrorAction SilentlyContinue
)

foreach ($manifestFile in $manifests) {
    try {
        $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestFile.FullName | ConvertFrom-Json
    }
    catch {
        Add-CheckError "Invalid legacy manifest $($manifestFile.FullName)`: $($_.Exception.Message)"
        continue
    }

    $manifestFields = @($manifest.PSObject.Properties.Name)
    $requiredManifestFields = @('manifest_version', 'snapshot_id', 'classification', 'source', 'captured_at', 'files')
    $missingManifestFields = @($requiredManifestFields | Where-Object { $_ -notin $manifestFields })
    if ($missingManifestFields.Count -gt 0) {
        Add-CheckError "Legacy manifest is missing: $($missingManifestFields -join ', '): $($manifestFile.FullName)"
        continue
    }
    if ([string]$manifest.classification -cne 'untrusted-legacy') {
        Add-CheckError "Legacy manifest classification must be 'untrusted-legacy': $($manifestFile.FullName)"
    }

    foreach ($entry in @($manifest.files)) {
        $entryFields = @($entry.PSObject.Properties.Name)
        if ('path' -notin $entryFields -or 'sha256' -notin $entryFields -or 'size' -notin $entryFields) {
            Add-CheckError "Legacy manifest entry is incomplete: $($manifestFile.FullName)"
            continue
        }

        $snapshotRoot = $manifestFile.DirectoryName
        $entryPath = [System.IO.Path]::GetFullPath(
            (Join-Path $snapshotRoot ([string]$entry.path).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        )
        if (-not (Test-IsInside -Path $entryPath -Parent $snapshotRoot)) {
            Add-CheckError "Legacy manifest path escapes its snapshot: $($entry.path)"
            continue
        }
        if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
            Add-CheckError "Legacy snapshot file is missing: $($entry.path)"
            continue
        }

        $actualLegacyHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $entryPath).Hash.ToLowerInvariant()
        $actualLegacySize = (Get-Item -LiteralPath $entryPath).Length
        if ($actualLegacyHash -cne [string]$entry.sha256) {
            Add-CheckError "Legacy snapshot hash mismatch: $($entry.path)"
        }
        if ($actualLegacySize -ne [long]$entry.size) {
            Add-CheckError "Legacy snapshot size mismatch: $($entry.path)"
        }
    }
}

$notes.Add("Approved SPECs: $($approvedSpecs.Count)")
$notes.Add("Active tasks: $($activeTasks.Count)")
$notes.Add("Legacy manifests checked: $($manifests.Count)")

if ($errors.Count -gt 0) {
    Write-Host "[FAIL] Governance check found $($errors.Count) issue(s)." -ForegroundColor Red
    foreach ($message in $errors) {
        Write-Host "  - $message" -ForegroundColor Red
    }
    exit 1
}

Write-Host '[PASS] Governance structure and gates are consistent.' -ForegroundColor Green
foreach ($message in $notes) {
    Write-Host "  - $message"
}
