param(
  [Parameter(Mandatory=$true)][string]$DatabaseUrl,
  [Parameter(Mandatory=$true)][string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore is not installed or not in PATH. Install PostgreSQL client tools first."
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

Write-Host "Restoring backup: $BackupFile"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DatabaseUrl" "$BackupFile"

Write-Host "Restore completed."
