# Script simple pour vérifier l'état des services
Write-Host "Verification de l'etat des services dans la base de donnees..." -ForegroundColor Green

try {
    # Vérifier les services actifs
    $result = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            id, 
            titre, 
            active, 
            created_at,
            user_id
        FROM services 
        WHERE id IN (939282, 518829, 531974, 862419, 974024, 20977, 742692, 153)
        ORDER BY id;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Requete executee avec succes:" -ForegroundColor Green
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Erreur lors de la requete:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de l'execution:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "Script termine." -ForegroundColor Green 