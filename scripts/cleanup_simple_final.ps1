# Script simple pour nettoyer les services orphelins
Write-Host "Nettoyage des services orphelins..." -ForegroundColor Green

try {
    # Désactiver les services avec IDs > 1M
    Write-Host "Desactivation des services avec IDs eleves..." -ForegroundColor Yellow
    
    $result = & psql -h localhost -U postgres -d yukpo_db -c "
        UPDATE services 
        SET is_active = false, 
            updated_at = NOW() 
        WHERE id > 1000000;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Services avec IDs eleves desactives" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de la desactivation" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
    
    # Vérifier l'état final
    Write-Host "Verification de l'etat final..." -ForegroundColor Yellow
    
    $finalCheck = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            COUNT(*) as total_services,
            COUNT(CASE WHEN is_active = true THEN 1 END) as services_actifs,
            COUNT(CASE WHEN is_active = false THEN 1 END) as services_inactifs
        FROM services;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Etat final de la base:" -ForegroundColor Green
        Write-Host $finalCheck -ForegroundColor White
    } else {
        Write-Host "Erreur lors de la verification finale" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Nettoyage termine" -ForegroundColor Green 