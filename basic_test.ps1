# Script de test basique
Write-Host "Test de la base de donnees" -ForegroundColor Green

# Test de connexion
try {
    $result = psql -h localhost -U postgres -d yukpo_db -c "SELECT version();"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connexion a la base reussie" -ForegroundColor Green
    } else {
        Write-Host "Erreur de connexion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "psql non disponible" -ForegroundColor Red
    exit 1
}

# Verifier la structure de la table media
Write-Host "Verification de la table media..." -ForegroundColor Cyan
try {
    $columns = psql -h localhost -U postgres -d yukpo_db -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'media' ORDER BY ordinal_position;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Colonnes de la table media:" -ForegroundColor Green
        $columns | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        
        # Verifier les colonnes de recherche d'images
        $hasImageSignature = $columns -match "image_signature"
        $hasImageHash = $columns -match "image_hash"
        $hasImageMetadata = $columns -match "image_metadata"
        
        Write-Host "Etat des colonnes de recherche:" -ForegroundColor Yellow
        Write-Host "  - image_signature: $(if ($hasImageSignature) { 'OK' } else { 'MANQUANT' })" -ForegroundColor $(if ($hasImageSignature) { 'Green' } else { 'Red' })
        Write-Host "  - image_hash: $(if ($hasImageHash) { 'OK' } else { 'MANQUANT' })" -ForegroundColor $(if ($hasImageHash) { 'Green' } else { 'Red' })
        Write-Host "  - image_metadata: $(if ($hasImageMetadata) { 'OK' } else { 'MANQUANT' })" -ForegroundColor $(if ($hasImageMetadata) { 'Green' } else { 'Red' })
        
        if ($hasImageSignature -and $hasImageHash -and $hasImageMetadata) {
            Write-Host "Migration de recherche d'images appliquee" -ForegroundColor Green
        } else {
            Write-Host "Migration de recherche d'images manquante" -ForegroundColor Red
            Write-Host "Appliquez: migrations/20250110000000_extend_media_for_image_search.sql" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Erreur lors de la verification des colonnes" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de la verification" -ForegroundColor Red
}

Write-Host "Test termine!" -ForegroundColor Green 