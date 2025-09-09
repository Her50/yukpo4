# Script de réparation du fichier .env corrompu
Write-Host "🔧 Réparation du fichier .env corrompu..." -ForegroundColor Yellow

$envPath = Join-Path $PSScriptRoot "microservice_embedding\.env"
$templatePath = Join-Path $PSScriptRoot "microservice_embedding\env_template.txt"
$backupPath = Join-Path $PSScriptRoot "microservice_embedding\.env.backup"

# Sauvegarder l'ancien fichier s'il existe
if (Test-Path $envPath) {
    Write-Host "[BACKUP] Sauvegarde de l'ancien fichier .env..." -ForegroundColor Gray
    Copy-Item $envPath $backupPath -Force
    Write-Host "[BACKUP] Sauvegarde créée: $backupPath" -ForegroundColor Green
}

# Vérifier si le template existe
if (-not (Test-Path $templatePath)) {
    Write-Host "[ERREUR] Template env_template.txt non trouvé" -ForegroundColor Red
    exit 1
}

# Créer un nouveau fichier .env propre
Write-Host "[REPAIR] Création d'un nouveau fichier .env propre..." -ForegroundColor Yellow
try {
    # Lire le template avec l'encodage UTF-8
    $templateContent = Get-Content $templatePath -Encoding UTF8
    
    # Écrire le nouveau fichier .env avec l'encodage UTF-8
    $templateContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
    
    Write-Host "[REPAIR] Fichier .env réparé avec succès !" -ForegroundColor Green
    
    # Vérifier le contenu
    Write-Host "[VERIFY] Vérification du contenu..." -ForegroundColor Yellow
    $newContent = Get-Content $envPath -Encoding UTF8
    $pineconeLine = $newContent | Where-Object { $_ -match "PINECONE_API_KEY" }
    if ($pineconeLine) {
        Write-Host "[VERIFY] PINECONE_API_KEY trouvé: $pineconeLine" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] PINECONE_API_KEY non trouvé dans le nouveau fichier" -ForegroundColor Yellow
    }
    
    Write-Host "`n✅ Réparation terminée !" -ForegroundColor Green
    Write-Host "📝 N'oubliez pas de configurer vos vraies clés API dans le fichier .env" -ForegroundColor Cyan
    
} catch {
    Write-Host "[ERREUR] Impossible de réparer le fichier .env: $_" -ForegroundColor Red
    exit 1
}
