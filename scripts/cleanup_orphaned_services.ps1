# Script pour nettoyer les services orphelins et synchroniser la base de données
Write-Host "🧹 Nettoyage des services orphelins..." -ForegroundColor Green

try {
    # 1. Identifier les services avec des IDs très élevés qui n'existent probablement pas
    Write-Host "`n📊 Analyse des services..." -ForegroundColor Yellow
    
    $result = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            id,
            data->>'titre_service' as titre,
            category,
            is_active,
            created_at
        FROM services 
        WHERE id > 1000000
        ORDER BY id DESC
        LIMIT 20;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services avec IDs élevés trouvés:" -ForegroundColor Green
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'analyse:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
    
    # 2. Vérifier les services mentionnés dans les logs
    Write-Host "`n🔍 Vérification des services problématiques..." -ForegroundColor Yellow
    
    $problematicIds = @(275841, 508529, 373989, 970545, 609012, 921100, 518829, 862419, 939282)
    
    foreach ($id in $problematicIds) {
        $checkResult = & psql -h localhost -U postgres -d yukpo_db -c "
            SELECT id, data->>'titre_service' as titre, category, is_active 
            FROM services 
            WHERE id = $id;
        " 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            if ($checkResult -match "0 rows") {
                Write-Host "❌ Service $id : N'existe pas en base" -ForegroundColor Red
            } else {
                Write-Host "✅ Service $id : Existe en base" -ForegroundColor Green
                Write-Host $checkResult -ForegroundColor White
            }
        }
    }
    
    # 3. Nettoyer les services inactifs ou orphelins
    Write-Host "`n🧹 Nettoyage des services inactifs..." -ForegroundColor Yellow
    
    $cleanupResult = & psql -h localhost -U postgres -d yukpo_db -c "
        UPDATE services 
        SET is_active = false 
        WHERE id > 1000000 AND (data->>'titre_service' IS NULL OR data->>'titre_service' = '');
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services inactifs mis à jour" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors du nettoyage:" -ForegroundColor Red
        Write-Host $cleanupResult -ForegroundColor Red
    }
    
    # 4. Statistiques finales
    Write-Host "`n📈 Statistiques finales:" -ForegroundColor Yellow
    
    $finalStats = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            COUNT(*) as total_services,
            COUNT(CASE WHEN is_active = true THEN 1 END) as services_actifs,
            COUNT(CASE WHEN category IS NOT NULL THEN 1 END) as services_categorises
        FROM services;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Statistiques finales:" -ForegroundColor Green
        Write-Host $finalStats -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Erreur lors du nettoyage: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Nettoyage terminé!" -ForegroundColor Green 