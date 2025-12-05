# ✅ Script PowerShell pour exécuter la tâche cron des trajets récurrents
# Date: 2025-01-29
# Usage: .\scripts\recurring_trips_cron.ps1 [action] [days_ahead]

param(
    [string]$Action = "full",
    [int]$DaysAhead = 0
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Exécution tâche cron trajets récurrents: $Action" -ForegroundColor Cyan

Push-Location $PSScriptRoot\..

if ($DaysAhead -gt 0) {
    cargo run --bin recurring_trips_cron --release -- $Action $DaysAhead
}
else {
    cargo run --bin recurring_trips_cron --release -- $Action
}

Pop-Location

Write-Host "✅ Tâche terminée" -ForegroundColor Green

