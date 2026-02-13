# Script simple et fiable pour récupérer les logs ECS
# Écrit les logs dans un fichier pour éviter les problèmes d'encodage

param(
    [string]$Cluster = "yukpo-cluster",
    [string]$Service = "yukpo-backend-service",
    [string]$Region = "eu-west-1",
    [string]$LogGroup = "/ecs/yukpo-backend",
    [int]$Lines = 50,
    [switch]$ErrorsOnly
)

$ErrorActionPreference = "Continue"

Write-Host "Recuperation des logs ECS" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Créer un fichier de sortie
$outputFile = "ecs-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
Write-Host "Les logs seront sauvegardes dans: $outputFile" -ForegroundColor Yellow
Write-Host ""

# Fonction pour récupérer et écrire les logs
function Write-LogStreamToFile {
    param(
        [string]$StreamName,
        [string]$OutputPath
    )
    
    try {
        # Utiliser un fichier temporaire
        $tempFile = [System.IO.Path]::GetTempFileName()
        
        # Récupérer les logs
        aws logs get-log-events `
            --log-group-name $LogGroup `
            --log-stream-name $StreamName `
            --region $Region `
            --limit $Lines `
            --output text 2>&1 | Out-File -FilePath $tempFile -Encoding utf8
        
        if ($LASTEXITCODE -ne 0) {
            $errorContent = Get-Content $tempFile -Raw -ErrorAction SilentlyContinue
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            if ($errorContent -match "ResourceNotFoundException") {
                return $false
            }
            return $false
        }
        
        # Lire et traiter le contenu
        $content = Get-Content $tempFile -Raw -Encoding utf8
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        if ([string]::IsNullOrWhiteSpace($content)) {
            return $false
        }
        
        # Ajouter au fichier de sortie
        Add-Content -Path $OutputPath -Value "`n========================================" -Encoding utf8
        Add-Content -Path $OutputPath -Value "Stream: $StreamName" -Encoding utf8
        Add-Content -Path $OutputPath -Value "========================================`n" -Encoding utf8
        Add-Content -Path $OutputPath -Value $content -Encoding utf8
        
        return $true
    } catch {
        return $false
    }
}

# Initialiser le fichier de sortie
"Logs ECS - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $outputFile -Encoding utf8
"Cluster: $Cluster" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Service: $Service" | Out-File -FilePath $outputFile -Append -Encoding utf8
"Log Group: $LogGroup`n" | Out-File -FilePath $outputFile -Append -Encoding utf8

# 1. Récupérer les tâches en cours
Write-Host "1. Recherche des taches en cours..." -ForegroundColor Cyan

$tasksJson = aws ecs list-tasks `
    --cluster $Cluster `
    --service-name $Service `
    --desired-status RUNNING `
    --region $Region `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $tasks = $tasksJson | ConvertFrom-Json
    
    if ($tasks.taskArns.Count -gt 0) {
        Write-Host "   $($tasks.taskArns.Count) tache(s) trouvee(s)" -ForegroundColor Green
        
        foreach ($taskArn in $tasks.taskArns) {
            $taskId = $taskArn.Split('/')[-1]
            Write-Host "   Recuperation des logs pour: $taskId..." -ForegroundColor Yellow
            
            # Essayer différents formats
            $formats = @(
                "ecs/backend/$taskId",
                "backend/backend/$taskId",
                "backend/$taskId"
            )
            
            $found = $false
            foreach ($format in $formats) {
                if (Write-LogStreamToFile -StreamName $format -OutputPath $outputFile) {
                    Write-Host "     Logs recuperes depuis: $format" -ForegroundColor Green
                    $found = $true
                    break
                }
            }
            
            if (-not $found) {
                Write-Host "     Aucun log trouve pour cette tache" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   Aucune tache en cours" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Erreur: $tasksJson" -ForegroundColor Red
}

Write-Host ""

# 2. Récupérer les derniers streams
Write-Host "2. Recherche dans les derniers streams..." -ForegroundColor Cyan

$streamsJson = aws logs describe-log-streams `
    --log-group-name $LogGroup `
    --region $Region `
    --order-by LastEventTime `
    --descending `
    --max-items 10 `
    --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $streams = $streamsJson | ConvertFrom-Json
    
    if ($streams.logStreams) {
        Write-Host "   $($streams.logStreams.Count) stream(s) trouve(s)" -ForegroundColor Green
        
        $count = 0
        foreach ($stream in $streams.logStreams) {
            if ($count -ge 5) { break }
            
            $streamName = $stream.logStreamName
            Write-Host "   Recuperation: $streamName..." -ForegroundColor Yellow
            
            if (Write-LogStreamToFile -StreamName $streamName -OutputPath $outputFile) {
                Write-Host "     OK" -ForegroundColor Green
                $count++
            } else {
                Write-Host "     Aucun log" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "   Erreur: $streamsJson" -ForegroundColor Red
}

Write-Host ""
Write-Host "Logs sauvegardes dans: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Pour afficher les logs:" -ForegroundColor Yellow
Write-Host "  Get-Content $outputFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour afficher uniquement les erreurs:" -ForegroundColor Yellow
Write-Host "  Get-Content $outputFile | Select-String -Pattern 'error|exception|failed|panic' -CaseSensitive:`$false" -ForegroundColor Cyan

