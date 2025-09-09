# Script simple pour nettoyer les services orphelins
Write-Host "Nettoyage des services orphelins..." -ForegroundColor Green

try {
    # Vérifier les services problématiques
    Write-Host "Verification des services problematiques..." -ForegroundColor Yellow
    
    $problematicIds = @(275841, 508529, 373989, 970545, 609012, 921100, 518829, 862419, 939282)
    
    foreach ($id in $problematicIds) {
        $checkResult = & psql -h localhost -U postgres -d yukpo_db -c "
            SELECT id, data->>'titre_service' as titre, category, is_active 
            FROM services 
            WHERE id = $id;
        " 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            if ($checkResult -match "0 rows") {
                Write-Host "Service $id : N'existe pas en base" -ForegroundColor Red
            } else {
                Write-Host "Service $id : Existe en base" -ForegroundColor Green
            }
        }
    }
    
    # Nettoyer les services inactifs
    Write-Host "Nettoyage des services inactifs..." -ForegroundColor Yellow
    
    $cleanupResult = & psql -h localhost -U postgres -d yukpo_db -c "
        UPDATE services 
        SET is_active = false 
        WHERE id > 1000000 AND (data->>'titre_service' IS NULL OR data->>'titre_service' = '');
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Services inactifs mis a jour" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors du nettoyage:" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Erreur lors du nettoyage: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Nettoyage termine!" -ForegroundColor Green 