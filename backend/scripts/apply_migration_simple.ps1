# Script simple pour appliquer la migration
Write-Host "Application de la migration des fonctionnalites avancees..." -ForegroundColor Green

# Chemin vers la migration
$migrationFile = "migrations/20250101_001_create_advanced_features_tables.sql"

# Vérifier que le fichier existe
if (-not (Test-Path $migrationFile)) {
    Write-Host "Fichier de migration non trouve: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier de migration trouve: $migrationFile" -ForegroundColor Yellow

# Appliquer la migration avec psql
Write-Host "Application de la migration..." -ForegroundColor Cyan

try {
    # Utiliser l'utilisateur postgres pour la base yukpo_db
    $result = & psql -h localhost -U postgres -d yukpo_db -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration appliquee avec succes !" -ForegroundColor Green
        Write-Host "Tables creees:" -ForegroundColor Yellow
        Write-Host "   - push_subscriptions (notifications push)" -ForegroundColor White
        Write-Host "   - voice_messages (messages vocaux)" -ForegroundColor White
        Write-Host "   - shared_files (partage de fichiers)" -ForegroundColor White
        Write-Host "   - file_downloads (suivi telechargements)" -ForegroundColor White
        Write-Host "   - typing_status (statut de frappe)" -ForegroundColor White
    } else {
        Write-Host "Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "Script termine." -ForegroundColor Green 