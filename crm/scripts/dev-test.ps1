# scripts/dev-test.ps1 — S6 full local test suite runner
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1 -WithPostgresql
# PostgreSQL-gated tests (test_s6_integration, test_task0007_postgresql_sessions,
# test_migrations, test_s4_authentication gated cases) are skipped unless
# CRM_RUN_POSTGRESQL_TESTS=1 and the DATABASE_* environment variables point
# at the isolated crm_test database.
param(
    [switch]$WithPostgresql
)
Set-Location (Join-Path $PSScriptRoot "..")
$env:PYTHONPATH = "src"
if ($WithPostgresql -or $env:CRM_RUN_POSTGRESQL_TESTS -eq "1") {
    $env:CRM_RUN_POSTGRESQL_TESTS = "1"
    Write-Host "[dev-test] Running with PostgreSQL gates enabled"
} else {
    Write-Host "[dev-test] Running local-only tests (PostgreSQL-gated tests skipped)"
}
& .venv\Scripts\python.exe -m pytest tests -q
exit $LASTEXITCODE
