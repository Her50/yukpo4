# Script pour appliquer la migration des champs média aux services
# Date: 2025-08-30

Write-Host "🎯 Application de la migration des champs média aux services..." -ForegroundColor Green

# Configuration de la base de données
$DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"
$MIGRATION_FILE = "migrations/20250830_add_media_fields_to_services.sql"

# Vérifier que le fichier de migration existe
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Fichier de migration non trouvé: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de migration trouvé: $MIGRATION_FILE" -ForegroundColor Green

# Lire le contenu du fichier SQL
$sqlContent = Get-Content $MIGRATION_FILE -Raw

if (-not $sqlContent) {
    Write-Host "❌ Le fichier de migration est vide" -ForegroundColor Red
    exit 1
}

Write-Host "📖 Contenu du fichier de migration lu avec succès" -ForegroundColor Green

# Diviser le contenu SQL en commandes individuelles
$commands = $sqlContent -split ";" | Where-Object { $_.Trim() -ne "" }

Write-Host "🔧 Exécution de $($commands.Count) commandes SQL..." -ForegroundColor Yellow

# Exécuter chaque commande SQL
$successCount = 0
$errorCount = 0

foreach ($command in $commands) {
    $command = $command.Trim()
    if ($command -eq "") { continue }
    
    try {
        Write-Host "  → Exécution: $($command.Substring(0, [Math]::Min(50, $command.Length)))..." -ForegroundColor Cyan
        
        # Exécuter la commande SQL
        $result = psql $DATABASE_URL -c $command 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ Succès" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "    ❌ Erreur: $result" -ForegroundColor Red
            $errorCount++
        }
    }
    catch {
        Write-Host "    ❌ Exception: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

# Résumé
Write-Host "`n📊 Résumé de la migration:" -ForegroundColor Magenta
Write-Host "  ✅ Commandes réussies: $successCount" -ForegroundColor Green
Write-Host "  ❌ Commandes échouées: $errorCount" -ForegroundColor Red

if ($errorCount -eq 0) {
    Write-Host "`n🎉 Migration appliquée avec succès !" -ForegroundColor Green
    Write-Host "   Les champs média ont été ajoutés aux services." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Migration partiellement réussie avec $errorCount erreur(s)" -ForegroundColor Yellow
    Write-Host "   Vérifiez les erreurs ci-dessus." -ForegroundColor Yellow
}

Write-Host "`n🔍 Vérification de la structure de la table services..." -ForegroundColor Blue

# Vérifier que les colonnes ont été ajoutées
try {
    $checkResult = psql $DATABASE_URL -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('logo', 'banniere', 'images_realisations', 'videos') ORDER BY column_name;"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Structure de la table services vérifiée:" -ForegroundColor Green
        Write-Host $checkResult -ForegroundColor White
    } else {
        Write-Host "⚠️  Impossible de vérifier la structure de la table" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️  Erreur lors de la vérification: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n🏁 Migration terminée !" -ForegroundColor Green 