# Verification des fonctions SQL et index
Write-Host "Verification des fonctions SQL et index..." -ForegroundColor Green

# Verifier les fonctions
Write-Host "`nFonctions SQL:" -ForegroundColor Cyan
try {
    $functions = psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('search_similar_images', 'calculate_image_similarity');"
    if ($LASTEXITCODE -eq 0) {
        $functions | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "Erreur lors de la verification des fonctions" -ForegroundColor Red
}

# Verifier les index
Write-Host "`nIndex de recherche d'images:" -ForegroundColor Cyan
try {
    $indexes = psql -h localhost -U postgres -d yukpo_db -c "SELECT indexname FROM pg_indexes WHERE tablename = 'media' AND indexname LIKE '%image%';"
    if ($LASTEXITCODE -eq 0) {
        $indexes | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "Erreur lors de la verification des index" -ForegroundColor Red
}

# Verifier les medias existants
Write-Host "`nMedias existants:" -ForegroundColor Cyan
try {
    $mediaCount = psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) as total, COUNT(CASE WHEN type = 'image' THEN 1 END) as images FROM media;"
    if ($LASTEXITCODE -eq 0) {
        $mediaCount | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
    
    $imagesWithSignature = psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) FROM media WHERE type = 'image' AND image_signature IS NOT NULL;"
    if ($LASTEXITCODE -eq 0) {
        $imagesWithSignature | ForEach-Object { Write-Host "  Images avec signatures: $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "Erreur lors de la verification des medias" -ForegroundColor Red
}

Write-Host "`nVerification terminee!" -ForegroundColor Green 