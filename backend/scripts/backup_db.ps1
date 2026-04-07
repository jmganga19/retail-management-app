param(
  [Parameter(Mandatory=$true)][string]$DatabaseUrl,
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump is not installed or not in PATH. Install PostgreSQL client tools first."
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OutputDir "retail_backup_$timestamp.dump"

Write-Host "Creating backup: $outFile"
pg_dump --format=custom --no-owner --no-privileges --dbname "$DatabaseUrl" --file "$outFile"

Write-Host "Backup completed: $outFile"
