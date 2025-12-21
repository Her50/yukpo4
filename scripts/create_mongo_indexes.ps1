# Script pour créer les index MongoDB
# Usage: .\create_mongo_indexes.ps1

Write-Host "🔍 Configuration MongoDB..." -ForegroundColor Yellow
$MONGODB_URL = $env:MONGODB_URL

if ([string]::IsNullOrWhiteSpace($MONGODB_URL)) {
    Write-Host "⚠️ Variable MONGODB_URL non définie." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour créer les index MongoDB, vous devez:" -ForegroundColor White
    Write-Host "1. Définir la variable MONGODB_URL:" -ForegroundColor White
    Write-Host "   `$env:MONGODB_URL = 'mongodb://...' ou 'mongodb+srv://...'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Ou exécuter manuellement avec mongosh:" -ForegroundColor White
    Write-Host "   mongosh 'VOTRE_URL_MONGODB' --file scripts/create_mongo_indexes.js" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Les commandes à exécuter sont dans scripts/create_mongo_indexes.js" -ForegroundColor Gray
    exit 1
}

Write-Host "📝 Création des index MongoDB..." -ForegroundColor Yellow
Write-Host "URL MongoDB: $($MONGODB_URL.Substring(0, [Math]::Min(50, $MONGODB_URL.Length)))..." -ForegroundColor Gray

try {
    & mongosh $MONGODB_URL --file scripts/create_mongo_indexes.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Index MongoDB créés avec succès!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Erreur lors de la création des index MongoDB (code: $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host "Essayez d'exécuter manuellement: mongosh '$MONGODB_URL' --file scripts/create_mongo_indexes.js" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️ mongosh non disponible ou erreur: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour créer les index manuellement:" -ForegroundColor White
    Write-Host "1. Connectez-vous à MongoDB (mongosh ou Compass)" -ForegroundColor White
    Write-Host "2. Exécutez les commandes suivantes:" -ForegroundColor White
    Write-Host ""
    Write-Host "db.history.createIndex({ 'service_id': 1, 'event_type': 1 }, { name: 'idx_history_service_event', background: true });" -ForegroundColor Cyan
    Write-Host "db.history.createIndex({ 'service_id': 1, 'data.interaction_type': 1 }, { name: 'idx_history_service_interaction', background: true });" -ForegroundColor Cyan
}

