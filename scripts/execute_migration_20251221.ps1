# Script pour exécuter la migration 20251221_optimize_slow_endpoints.sql
# et créer les index MongoDB

Write-Host "🚀 Exécution de la migration 20251221_optimize_slow_endpoints.sql" -ForegroundColor Green

# URL PostgreSQL (Render)
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db?sslmode=require"

# Chemin vers le fichier de migration
$MIGRATION_FILE = "backend/migrations/20251221_optimize_slow_endpoints.sql"

# Vérifier que le fichier existe
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Erreur: Fichier de migration introuvable: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lecture du fichier de migration..." -ForegroundColor Yellow
$migrationContent = Get-Content $MIGRATION_FILE -Raw

# Exécuter la migration avec psql
Write-Host "🔧 Exécution de la migration PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"

# Diviser le contenu en commandes individuelles (séparées par ;)
$commands = $migrationContent -split ";" | Where-Object { $_.Trim() -ne "" }

foreach ($command in $commands) {
    $command = $command.Trim()
    if ($command -ne "") {
        Write-Host "  → Exécution: $($command.Substring(0, [Math]::Min(80, $command.Length)))..." -ForegroundColor Gray
        try {
            $result = $command | & psql $DATABASE_URL 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ⚠️ Avertissement (peut être normal si l'index existe déjà): $result" -ForegroundColor Yellow
            } else {
                Write-Host "  ✅ Succès" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️ Avertissement: $_" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n✅ Migration PostgreSQL terminée" -ForegroundColor Green

# MongoDB - Demander l'URL si nécessaire
Write-Host "`n🔍 Configuration MongoDB..." -ForegroundColor Yellow
$MONGODB_URL = $env:MONGODB_URL

if ([string]::IsNullOrWhiteSpace($MONGODB_URL)) {
    Write-Host "⚠️ Variable MONGODB_URL non définie." -ForegroundColor Yellow
    Write-Host "Pour créer les index MongoDB, vous devez:" -ForegroundColor Yellow
    Write-Host "1. Se connecter à MongoDB (mongosh ou Compass)" -ForegroundColor White
    Write-Host "2. Exécuter les commandes suivantes:" -ForegroundColor White
    Write-Host ""
    Write-Host "db.history.createIndex({ 'service_id': 1, 'event_type': 1 });" -ForegroundColor Cyan
    Write-Host "db.history.createIndex({ 'service_id': 1, 'data.interaction_type': 1 });" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "📝 Création des index MongoDB..." -ForegroundColor Yellow
    Write-Host "URL MongoDB: $($MONGODB_URL.Substring(0, [Math]::Min(50, $MONGODB_URL.Length)))..." -ForegroundColor Gray
    
    # Créer un script JavaScript temporaire pour MongoDB
    $mongoScript = @"
use yukpomnang;

// Index pour optimiser get_interactions
db.history.createIndex(
    { "service_id": 1, "event_type": 1 },
    { name: "idx_history_service_event" }
);

// Index pour optimiser get_reviews
db.history.createIndex(
    { "service_id": 1, "data.interaction_type": 1 },
    { name: "idx_history_service_interaction" }
);

print("✅ Index MongoDB créés avec succès");
"@

    $mongoScript | Out-File -FilePath "temp_mongo_indexes.js" -Encoding UTF8
    
    Write-Host "  → Exécution des commandes MongoDB..." -ForegroundColor Gray
    try {
        & mongosh $MONGODB_URL --file temp_mongo_indexes.js
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Index MongoDB créés avec succès" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ Erreur lors de la création des index MongoDB" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️ mongosh non disponible. Veuillez exécuter manuellement:" -ForegroundColor Yellow
        Write-Host "  mongosh '$MONGODB_URL' --file temp_mongo_indexes.js" -ForegroundColor Cyan
    }
    
    # Nettoyer le fichier temporaire
    if (Test-Path "temp_mongo_indexes.js") {
        Remove-Item "temp_mongo_indexes.js"
    }
}

Write-Host "`n✅ Migration complète terminée!" -ForegroundColor Green

