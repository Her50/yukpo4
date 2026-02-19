# Script pour analyser les logs lors d'une création de produit
# Surveille les logs en temps réel et filtre les erreurs liées à la création de produit

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$ServiceName = "yukpo-backend",
    [int]$DurationMinutes = 10
)

Write-Host "🔍 Analyse des logs de création de produit" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Yellow
Write-Host "Durée: $DurationMinutes minutes" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Instructions:" -ForegroundColor Yellow
Write-Host "   1. Laissez ce script tourner" -ForegroundColor Yellow
Write-Host "   2. Créez un produit depuis l'interface" -ForegroundColor Yellow
Write-Host "   3. Les logs s'afficheront automatiquement" -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
Write-Host ""

$endTime = (Get-Date).AddMinutes($DurationMinutes)
$filter = "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName"

Write-Host "📊 Surveillance des logs (filtre: $filter)" -ForegroundColor Cyan
Write-Host ""

while ((Get-Date) -lt $endTime) {
    try {
        $logs = gcloud logging read "$filter" --limit=50 --project=$GcpProjectId --format=json --freshness=2m 2>&1 | ConvertFrom-Json
        
        foreach ($log in $logs) {
            $textPayload = if ($log.textPayload) { $log.textPayload } else { $log.jsonPayload.message }
            $timestamp = $log.timestamp
            $severity = $log.severity
            
            # Filtrer les logs liés aux produits, OpenAI, IA, orchestration
            if ($textPayload -and (
                $textPayload -like "*product*" -or 
                $textPayload -like "*produit*" -or 
                $textPayload -like "*OpenAI*" -or 
                $textPayload -like "*openai*" -or 
                $textPayload -like "*IA*" -or 
                $textPayload -like "*orchestration*" -or
                $textPayload -like "*401*" -or
                $textPayload -like "*403*" -or
                $textPayload -like "*error*" -or
                $textPayload -like "*Error*" -or
                $textPayload -like "*ERROR*"
            )) {
                $color = switch ($severity) {
                    "ERROR" { "Red" }
                    "WARNING" { "Yellow" }
                    default { "White" }
                }
                
                Write-Host "[$timestamp] $severity : $textPayload" -ForegroundColor $color
            }
        }
        
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "Erreur lors de la récupération des logs: $_" -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}

Write-Host ""
Write-Host "✅ Analyse terminée" -ForegroundColor Green

