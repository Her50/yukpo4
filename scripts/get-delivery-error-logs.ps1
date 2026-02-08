# Script pour récupérer les logs d'erreur de sauvegarde configuration livraison
param(
    [int]$Minutes = 30,
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""

# Changer l'encodage de la console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🔍 Recherche des logs d'erreur - Sauvegarde Configuration Livraison" -ForegroundColor Cyan
Write-Host "Période: Dernières $Minutes minutes" -ForegroundColor Yellow
Write-Host "Région: $Region" -ForegroundColor Yellow
Write-Host ""

# Récupérer les logs et sauvegarder dans un fichier temporaire
$tempFile = "temp_aws_logs_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

try {
    Write-Host "📥 Récupération des logs depuis CloudWatch..." -ForegroundColor Yellow
    
    # Utiliser Start-Process pour éviter les problèmes d'encodage
    $process = Start-Process -FilePath "aws" -ArgumentList @(
        "logs", "tail", "/ecs/yukpomnang-backend",
        "--since", "${Minutes}m",
        "--region", $Region
    ) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempFile -RedirectStandardError "temp_aws_logs_error.txt"
    
    if ($process.ExitCode -ne 0) {
        Write-Host "❌ Erreur lors de la récupération des logs" -ForegroundColor Red
        if (Test-Path "temp_aws_logs_error.txt") {
            Get-Content "temp_aws_logs_error.txt" -Encoding UTF8 | Write-Host
        }
        exit 1
    }
    
    if (-not (Test-Path $tempFile)) {
        Write-Host "❌ Fichier de logs non créé" -ForegroundColor Red
        exit 1
    }
    
    # Lire le fichier avec UTF-8
    Write-Host "🔍 Analyse des logs..." -ForegroundColor Yellow
    $content = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8)
    $lines = $content -split "`r?`n"
    
    # Filtrer les lignes pertinentes
    $relevantLines = $lines | Where-Object { 
        $_ -match "save_product_delivery_config" -or
        $_ -match "ERROR.*500" -or
        $_ -match "Erreur.*sauvegarde" -or
        $_ -match "❌" -or
        ($_ -match "ERROR" -and $_ -match "product-config")
    }
    
    if ($relevantLines) {
        Write-Host "`n❌ ERREURS TROUVÉES :" -ForegroundColor Red
        Write-Host "=" * 80 -ForegroundColor Red
        Write-Host ""
        
        $relevantLines | ForEach-Object {
            Write-Host $_ -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "=" * 80 -ForegroundColor Red
        
        # Exporter dans un fichier
        $exportFile = "erreur_sauvegarde_config_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
        $relevantLines | Out-File -FilePath $exportFile -Encoding UTF8
        Write-Host "✅ Erreurs exportées dans: $exportFile" -ForegroundColor Green
    } else {
        Write-Host "✅ Aucune erreur trouvée dans les $Minutes dernières minutes" -ForegroundColor Green
        Write-Host "💡 Essayez d'augmenter -Minutes (ex: -Minutes 60)" -ForegroundColor Yellow
        
        # Afficher les dernières lignes pour debug
        Write-Host "`n📋 Dernières lignes de logs (pour debug):" -ForegroundColor Gray
        $lines | Select-Object -Last 10 | ForEach-Object {
            Write-Host $_ -ForegroundColor Gray
        }
    }
    
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer les fichiers temporaires
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "temp_aws_logs_error.txt") {
        Remove-Item "temp_aws_logs_error.txt" -Force -ErrorAction SilentlyContinue
    }
}



