# Script pour récupérer les logs ECS via CloudWatch Logs Insights
# Évite les problèmes d'encodage en utilisant des fichiers

param(
    [string]$LogGroup = "/ecs/yukpo-backend",
    [string]$Region = "eu-west-1",
    [int]$Minutes = 30,
    [int]$Limit = 50
)

$ErrorActionPreference = "Continue"

Write-Host "Recuperation des logs ECS via CloudWatch Logs Insights" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Créer un fichier de sortie
$outputFile = "ecs-logs-insights-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

"Logs ECS via CloudWatch Logs Insights - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $outputFile -Encoding utf8
"Log Group: $LogGroup" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Periode: $Minutes dernieres minutes`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

Write-Host "Recherche des logs des $Minutes dernieres minutes..." -ForegroundColor Yellow

# Calculer les timestamps
$endTime = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$startTime = [DateTimeOffset]::Now.AddMinutes(-$Minutes).ToUnixTimeSeconds()

Write-Host "   De: $(Get-Date -Date ([DateTimeOffset]::FromUnixTimeSeconds($startTime).LocalDateTime))" -ForegroundColor Gray
Write-Host "   A:  $(Get-Date -Date ([DateTimeOffset]::FromUnixTimeSeconds($endTime).LocalDateTime))" -ForegroundColor Gray
Write-Host ""

# Créer la requête
$queryString = "fields @timestamp, @message | sort @timestamp desc | limit $Limit"

Write-Host "Lancement de la requete..." -ForegroundColor Yellow

# Lancer la requête
$tempQuery = [System.IO.Path]::GetTempFileName()
aws logs start-query `
    --log-group-name $LogGroup `
    --start-time $startTime `
    --end-time $endTime `
    --query-string $queryString `
    --region $Region `
    --output json 2>&1 | Out-File -FilePath $tempQuery -Encoding utf8

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors du lancement de la requete" -ForegroundColor Red
    $errorContent = Get-Content $tempQuery -Raw -Encoding utf8
    Write-Host $errorContent -ForegroundColor Red
    Remove-Item $tempQuery -Force -ErrorAction SilentlyContinue
    exit 1
}

$queryContent = [System.IO.File]::ReadAllText($tempQuery, [System.Text.Encoding]::UTF8)
$queryResult = $queryContent | ConvertFrom-Json
$queryId = $queryResult.queryId

Write-Host "   Query ID: $queryId" -ForegroundColor Gray
Write-Host "   Attente du traitement (5 secondes)..." -ForegroundColor Yellow

Remove-Item $tempQuery -Force -ErrorAction SilentlyContinue

# Attendre que la requête soit terminée
Start-Sleep -Seconds 5

# Récupérer les résultats
$maxRetries = 10
$retryCount = 0
$results = $null

while ($retryCount -lt $maxRetries) {
    $tempResults = [System.IO.Path]::GetTempFileName()
    
    aws logs get-query-results `
        --query-id $queryId `
        --region $Region `
        --output json 2>&1 | Out-File -FilePath $tempResults -Encoding utf8
    
    if ($LASTEXITCODE -eq 0) {
        $resultsContent = [System.IO.File]::ReadAllText($tempResults, [System.Text.Encoding]::UTF8)
        $results = $resultsContent | ConvertFrom-Json
        Remove-Item $tempResults -Force -ErrorAction SilentlyContinue
        
        if ($results.status -eq "Complete") {
            break
        } elseif ($results.status -eq "Running" -or $results.status -eq "Scheduled") {
            Write-Host "   Requete en cours... (tentative $($retryCount + 1)/$maxRetries)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
            $retryCount++
        } else {
            Write-Host "   Statut: $($results.status)" -ForegroundColor Yellow
            break
        }
    } else {
        Remove-Item $tempResults -Force -ErrorAction SilentlyContinue
        break
    }
}

if ($results -and $results.status -eq "Complete" -and $results.results) {
    $logCount = $results.results.Count
    Write-Host "   $logCount log(s) trouve(s)!" -ForegroundColor Green
    Write-Host ""
    
    # Écrire les logs dans le fichier
    [System.IO.File]::AppendAllText($outputFile, "========================================`n", $utf8NoBom)
    [System.IO.File]::AppendAllText($outputFile, "Logs recuperes: $logCount`n", $utf8NoBom)
    [System.IO.File]::AppendAllText($outputFile, "========================================`n`n", $utf8NoBom)
    
    foreach ($result in $results.results) {
        $timestamp = $null
        $message = $null
        
        foreach ($field in $result) {
            if ($field.field -eq "@timestamp") {
                $timestamp = $field.value
            } elseif ($field.field -eq "@message") {
                $message = $field.value
            }
        }
        
        if ($timestamp -and $message) {
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
    
    # Afficher un aperçu
    Write-Host "`nApercu des 5 derniers logs:" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    
    $previewCount = [Math]::Min(5, $results.results.Count)
    for ($i = 0; $i -lt $previewCount; $i++) {
        $result = $results.results[$i]
        $timestamp = $null
        $message = $null
        
        foreach ($field in $result) {
            if ($field.field -eq "@timestamp") {
                $timestamp = $field.value
            } elseif ($field.field -eq "@message") {
                $message = $field.value
            }
        }
        
        if ($timestamp -and $message) {
            # Nettoyer le message pour l'affichage
            $cleanMessage = $message -replace '[^\x20-\x7E\n\r]', ''
            Write-Host "[$timestamp] $cleanMessage" -ForegroundColor White
        }
    }
    
} else {
    Write-Host "Aucun log trouve ou requete incomplete" -ForegroundColor Yellow
    if ($results) {
        Write-Host "Statut: $($results.status)" -ForegroundColor Gray
    }
}

Write-Host ""

