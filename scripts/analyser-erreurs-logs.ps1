# Analyse des erreurs dans les logs Cloud SQL
param(
    [string]$LogFile = "downloaded-logs-20260216-023936.csv"
)

Write-Host "`n📊 ANALYSE DES ERREURS DANS LES LOGS`n" -ForegroundColor Cyan

if (-not (Test-Path $LogFile)) {
    Write-Host "❌ Fichier non trouvé: $LogFile" -ForegroundColor Red
    exit 1
}

$logs = Import-Csv $LogFile
Write-Host "Total de lignes: $($logs.Count)" -ForegroundColor White

$errors = $logs | Where-Object { $_.severity -eq "ERROR" }
Write-Host "Nombre d'erreurs: $($errors.Count)" -ForegroundColor $(if($errors.Count -gt 0){"Red"}else{"Green"})

Write-Host "`n🔍 Erreurs principales:" -ForegroundColor Yellow

# Analyser les erreurs par type
$errorTypes = $errors | Group-Object { 
    if ($_.textPayload -match "relation.*does not exist") {
        $match = [regex]::Match($_.textPayload, 'relation "([^"]+)" does not exist')
        if ($match.Success) {
            "Table manquante: $($match.Groups[1].Value)"
        } else {
            "Table manquante (inconnue)"
        }
    } elseif ($_.textPayload -match "ERROR") {
        "Erreur PostgreSQL"
    } else {
        "Autre erreur"
    }
} | Sort-Object Count -Descending

foreach ($errorType in $errorTypes) {
    Write-Host "`n[$($errorType.Count) fois] $($errorType.Name)" -ForegroundColor $(if($errorType.Count -gt 5){"Red"}else{"Yellow"})
    if ($errorType.Name -match "Table manquante") {
        Write-Host "  ⚠️  Cette table doit être créée via une migration" -ForegroundColor Yellow
    }
}

Write-Host "`n📋 Recommandations:" -ForegroundColor Cyan
Write-Host "1. Vérifier que les migrations ont été exécutées" -ForegroundColor White
Write-Host "2. Créer la table manquante si nécessaire" -ForegroundColor White
Write-Host "3. Vérifier que ENABLE_SQLX_MIGRATIONS=true sur Cloud Run" -ForegroundColor White


