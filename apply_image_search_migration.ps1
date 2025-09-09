# Script PowerShell pour appliquer la migration de recherche d'images
# Ce script vérifie et applique automatiquement la migration si nécessaire

param(
    [string]$DatabaseUrl = "postgresql://username:password@localhost:5432/yukpo_db",
    [string]$MigrationFile = "migrations/20250110000000_extend_media_for_image_search.sql"
)

Write-Host "🔧 Application de la migration de recherche d'images" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

# Vérifier que le fichier de migration existe
if (-not (Test-Path $MigrationFile)) {
    Write-Host "❌ Fichier de migration non trouvé: $MigrationFile" -ForegroundColor Red
    Write-Host "💡 Vérifiez le chemin du fichier de migration" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Fichier de migration trouvé: $MigrationFile" -ForegroundColor Green

# Vérifier que psql est disponible
try {
    $psqlVersion = & psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ psql disponible: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non disponible"
    }
} catch {
    Write-Host "❌ psql non disponible. Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Red
    exit 1
}

# Vérifier la connexion à la base de données
Write-Host "🔍 Test de connexion à la base de données..." -ForegroundColor Cyan
try {
    $testConnection = & psql -h localhost -U postgres -d yukpo_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion à la base de données réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Impossible de se connecter à la base de données" -ForegroundColor Red
        Write-Host "💡 Vérifiez les paramètres de connexion et que PostgreSQL est démarré" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion à la base de données: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Vérifier l'état actuel de la table media
Write-Host "🔍 Vérification de l'état actuel de la table media..." -ForegroundColor Cyan
try {
    $currentStructure = & psql -h localhost -U postgres -d yukpo_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' AND column_name IN ('image_signature', 'image_hash', 'image_metadata') ORDER BY column_name;" 2>&1
    
    $hasImageSignature = $currentStructure -match "image_signature"
    $hasImageHash = $currentStructure -match "image_hash"
    $hasImageMetadata = $currentStructure -match "image_metadata"
    
    if ($hasImageSignature -and $hasImageHash -and $hasImageMetadata) {
        Write-Host "✅ Migration déjà appliquée - toutes les colonnes sont présentes" -ForegroundColor Green
        Write-Host "🎯 Aucune action requise" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "⚠️ Migration partielle ou manquante détectée:" -ForegroundColor Yellow
        Write-Host "  - image_signature: $(if ($hasImageSignature) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageSignature) { 'Green' } else { 'Red' })
        Write-Host "  - image_hash: $(if ($hasImageHash) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageHash) { 'Green' } else { 'Red' })
        Write-Host "  - image_metadata: $(if ($hasImageMetadata) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageMetadata) { 'Green' } else { 'Red' })
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de la structure: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Vérifier les fonctions existantes
Write-Host "🔍 Vérification des fonctions de recherche d'images..." -ForegroundColor Cyan
try {
    $existingFunctions = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('search_similar_images', 'calculate_image_similarity');" 2>&1
    
    $hasSearchFunction = $existingFunctions -match "search_similar_images"
    $hasSimilarityFunction = $existingFunctions -match "calculate_image_similarity"
    
    Write-Host "  - search_similar_images: $(if ($hasSearchFunction) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasSearchFunction) { 'Green' } else { 'Red' })
    Write-Host "  - calculate_image_similarity: $(if ($hasSimilarityFunction) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasSimilarityFunction) { 'Green' } else { 'Red' })
} catch {
    Write-Host "⚠️ Impossible de vérifier les fonctions existantes" -ForegroundColor Yellow
}

# Demander confirmation avant d'appliquer la migration
Write-Host "`n⚠️ ATTENTION: Cette opération va modifier la structure de la base de données" -ForegroundColor Yellow
$confirmation = Read-Host "Voulez-vous continuer? (oui/non)"
if ($confirmation -ne "oui") {
    Write-Host "❌ Migration annulée par l'utilisateur" -ForegroundColor Red
    exit 0
}

# Créer une sauvegarde de la table media
Write-Host "💾 Création d'une sauvegarde de la table media..." -ForegroundColor Cyan
try {
    $backupFile = "backup_media_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    $backupCommand = "pg_dump -h localhost -U postgres -d yukpo_db -t media --data-only --no-owner --no-privileges > $backupFile"
    
    Write-Host "  Commande de sauvegarde: $backupCommand" -ForegroundColor Gray
    
    # Exécuter la sauvegarde
    $backupResult = & psql -h localhost -U postgres -d yukpo_db -c "COPY (SELECT * FROM media) TO STDOUT;" > $backupFile 2>&1
    
    if (Test-Path $backupFile) {
        $fileSize = (Get-Item $backupFile).Length
        Write-Host "✅ Sauvegarde créée: $backupFile ($fileSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Sauvegarde échouée, mais continuation..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Impossible de créer la sauvegarde: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Appliquer la migration
Write-Host "🚀 Application de la migration..." -ForegroundColor Cyan
try {
    # Lire le contenu du fichier de migration
    $migrationContent = Get-Content $MigrationFile -Raw
    
    if (-not $migrationContent) {
        throw "Fichier de migration vide"
    }
    
    Write-Host "  Contenu du fichier de migration chargé ($($migrationContent.Length) caractères)" -ForegroundColor Gray
    
    # Appliquer la migration en exécutant le fichier SQL
    $migrationResult = & psql -h localhost -U postgres -d yukpo_db -f $MigrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $migrationResult -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Erreur lors de l'application de la migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Vérifier que la migration a été appliquée
Write-Host "🔍 Vérification post-migration..." -ForegroundColor Cyan
try {
    $postMigrationStructure = & psql -h localhost -U postgres -d yukpo_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' AND column_name IN ('image_signature', 'image_hash', 'image_metadata') ORDER BY column_name;" 2>&1
    
    $postImageSignature = $postMigrationStructure -match "image_signature"
    $postImageHash = $postMigrationStructure -match "image_hash"
    $postImageMetadata = $postMigrationStructure -match "image_metadata"
    
    if ($postImageSignature -and $postImageHash -and $postImageMetadata) {
        Write-Host "✅ Migration réussie - toutes les colonnes sont maintenant présentes" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration incomplète - certaines colonnes sont manquantes" -ForegroundColor Red
        exit 1
    }
    
    # Vérifier les fonctions
    $postFunctions = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('search_similar_images', 'calculate_image_similarity');" 2>&1
    
    $postSearchFunction = $postFunctions -match "search_similar_images"
    $postSimilarityFunction = $postFunctions -match "calculate_image_similarity"
    
    if ($postSearchFunction -and $postSimilarityFunction) {
        Write-Host "✅ Toutes les fonctions sont maintenant présentes" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Certaines fonctions sont manquantes" -ForegroundColor Yellow
    }
    
    # Vérifier les index
    $postIndexes = & psql -h localhost -U postgres -d yukpo_db -c "SELECT indexname FROM pg_indexes WHERE tablename = 'media' AND indexname LIKE '%image%';" 2>&1
    
    if ($postIndexes) {
        Write-Host "✅ Index de recherche d'images créés:" -ForegroundColor Green
        $postIndexes | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } else {
        Write-Host "⚠️ Aucun index de recherche d'images trouvé" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erreur lors de la vérification post-migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Nettoyer les fichiers temporaires
if (Test-Path $backupFile) {
    Write-Host "🗑️ Nettoyage des fichiers temporaires..." -ForegroundColor Cyan
    Remove-Item $backupFile -Force
    Write-Host "✅ Fichiers temporaires nettoyés" -ForegroundColor Green
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "🎉 Migration de recherche d'images appliquée avec succès!" -ForegroundColor Green
Write-Host "`n🔧 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Redémarrez le backend pour prendre en compte les changements" -ForegroundColor Cyan
Write-Host "2. Lancez le script de test: .\test_image_search.ps1" -ForegroundColor Cyan
Write-Host "3. Vérifiez que la recherche d'images fonctionne" -ForegroundColor Cyan

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan 