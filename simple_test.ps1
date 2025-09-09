# Script simple pour tester la base de données
Write-Host "🔍 Test simple de la base de données" -ForegroundColor Green

# Test de connexion
try {
    $result = & psql -h localhost -U postgres -d yukpo_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion à la base réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur de connexion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ psql non disponible" -ForegroundColor Red
    exit 1
}

# Vérifier la structure de la table media
Write-Host "🔍 Vérification de la table media..." -ForegroundColor Cyan
try {
    $columns = & psql -h localhost -U postgres -d yukpo_db -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'media' ORDER BY ordinal_position;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Colonnes de la table media:" -ForegroundColor Green
        $columns | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        
        # Vérifier les colonnes de recherche d'images
        $hasImageSignature = $columns -match "image_signature"
        $hasImageHash = $columns -match "image_hash"
        $hasImageMetadata = $columns -match "image_metadata"
        
        Write-Host "`n📊 État des colonnes de recherche:" -ForegroundColor Yellow
        Write-Host "  - image_signature: $(if ($hasImageSignature) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageSignature) { 'Green' } else { 'Red' })
        Write-Host "  - image_hash: $(if ($hasImageHash) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageHash) { 'Green' } else { 'Red' })
        Write-Host "  - image_metadata: $(if ($hasImageMetadata) { '✅' } else { '❌' })" -ForegroundColor $(if ($hasImageMetadata) { 'Green' } else { 'Red' })
        
        if ($hasImageSignature -and $hasImageHash -and $hasImageMetadata) {
            Write-Host "`n✅ Migration de recherche d'images appliquée" -ForegroundColor Green
        } else {
            Write-Host "`n❌ Migration de recherche d'images manquante" -ForegroundColor Red
            Write-Host "💡 Appliquez: migrations/20250110000000_extend_media_for_image_search.sql" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Erreur lors de la vérification des colonnes" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification" -ForegroundColor Red
}

Write-Host "`n🎯 Test terminé!" -ForegroundColor Green 