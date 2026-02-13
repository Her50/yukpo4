# Script pour récupérer les logs via CloudWatch Logs Insights
# Plus fiable que get-log-events pour les logs récents

param(
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1",
    [int]$Minutes = 60
)

$ErrorActionPreference = "Continue"

Write-Host "Recuperation des logs via CloudWatch Logs Insights" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Calculer les timestamps
$endTime = [DateTimeOffset]::UtcNow
$startTime = $endTime.AddMinutes(-$Minutes)
$startTimeMs = $startTime.ToUnixTimeMilliseconds()
$endTimeMs = $endTime.ToUnixTimeMilliseconds()

Write-Host "Periode: $($startTime.ToString('yyyy-MM-dd HH:mm:ss')) UTC -> $($endTime.ToString('yyyy-MM-dd HH:mm:ss')) UTC" -ForegroundColor Yellow
Write-Host ""

# Requête CloudWatch Logs Insights
$query = @"
fields @timestamp, @message
| filter @message like /yukpo|database|connexion|migration|server|error|erreur/
| sort @timestamp desc
| limit 200
"@

Write-Host "Envoi de la requete..." -ForegroundColor Yellow

# Créer un fichier temporaire pour la requête
$queryFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($queryFile, $query, $utf8NoBom)

# Créer le fichier de sortie
$outputFile = "logs-insights-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

try {
    # Démarrer la requête
    $startQueryOutput = aws logs start-query `
        --log-group-name $LogGroup `
        --start-time $startTimeMs `
        --end-time $endTimeMs `
        --query-string $query `
        --region $Region `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors du demarrage de la requete: $startQueryOutput" -ForegroundColor Red
        exit 1
    }
    
    $startResult = $startQueryOutput | ConvertFrom-Json
    $queryId = $startResult.queryId
    
    Write-Host "Requete demarree (ID: $queryId)" -ForegroundColor Green
    Write-Host "Attente des resultats..." -ForegroundColor Yellow
    
    # Attendre que la requête soit terminée
    $maxWait = 30
    $waited = 0
    $completed = $false
    
    while ($waited -lt $maxWait -and -not $completed) {
        Start-Sleep -Seconds 2
        $waited += 2
        
        $getResultsOutput = aws logs get-query-results `
            --query-id $queryId `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $results = $getResultsOutput | ConvertFrom-Json
            
            if ($results.status -eq "Complete") {
                $completed = $true
                Write-Host "Requete terminee" -ForegroundColor Green
                Write-Host ""
                
                # Traiter les résultats
                if ($results.results -and $results.results.Count -gt 0) {
                    Write-Host "  $($results.results.Count) resultat(s) trouve(s)" -ForegroundColor Green
                    Write-Host ""
                    
                    # Écrire dans le fichier
                    "Logs CloudWatch Logs Insights - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $outputFile -Encoding utf8
                    "Periode: $($startTime.ToString('yyyy-MM-dd HH:mm:ss')) UTC -> $($endTime.ToString('yyyy-MM-dd HH:mm:ss')) UTC`n" | Out-File -FilePath $outputFile -Append -Encoding utf8
                    
                    # Trier par timestamp (du plus ancien au plus récent)
                    $sortedResults = $results.results | Sort-Object { 
                        $tsField = $_.fields | Where-Object { $_.field -eq "@timestamp" }
                        if ($tsField) { [long]$tsField.value } else { 0 }
                    }
                    
                    foreach ($result in $sortedResults) {
                        $timestamp = ""
                        $message = ""
                        
                        foreach ($field in $result.fields) {
                            if ($field.field -eq "@timestamp") {
                                $timestamp = $field.value
                            } elseif ($field.field -eq "@message") {
                                $message = $field.value
                            }
                        }
                        
                        if ($message) {
                            $logLine = "[$timestamp] $message`n"
                            [System.IO.File]::AppendAllText($outputFile, $logLine, $utf8NoBom)
                        }
                    }
                    
                    Write-Host "Logs sauvegardes dans: $outputFile" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Pour afficher les logs:" -ForegroundColor Yellow
                    Write-Host "  Get-Content $outputFile -Encoding UTF8" -ForegroundColor Cyan
                    Write-Host ""
                    Write-Host "Pour afficher uniquement les erreurs:" -ForegroundColor Yellow
                    Write-Host "  Get-Content $outputFile -Encoding UTF8 | Select-String -Pattern '(?i)(error|exception|failed|panic|fatal)'" -ForegroundColor Cyan
                } else {
                    Write-Host "  Aucun resultat trouve" -ForegroundColor Yellow
                }
            } elseif ($results.status -eq "Failed") {
                Write-Host "La requete a echoue" -ForegroundColor Red
                exit 1
            }
        }
    }
    
    if (-not $completed) {
        Write-Host "Timeout: La requete n'a pas ete terminee dans les delais" -ForegroundColor Yellow
    }
    
} finally {
    if (Test-Path $queryFile) {
        Remove-Item $queryFile -Force -ErrorAction SilentlyContinue
    }
}

