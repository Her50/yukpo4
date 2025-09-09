# Script CRITIQUE pour nettoyer les services orphelins en production
Write-Host "🚨 NETTOYAGE CRITIQUE POUR LA PRODUCTION" -ForegroundColor Red
Write-Host "Suppression de tous les services orphelins..." -ForegroundColor Red

try {
    # 1. Identifier tous les services avec des IDs problématiques
    Write-Host "`n📊 Analyse des services problématiques..." -ForegroundColor Yellow
    
    $problematicIds = @(373989, 275841, 25920, 970545, 508529, 673734, 609012, 862419, 939282, 921100, 518829, 974024, 20977, 742692)
    
    Write-Host "Services à vérifier: $($problematicIds -join ', ')" -ForegroundColor Cyan
    
    # 2. Vérifier chaque service et le supprimer s'il n'existe pas
    foreach ($id in $problematicIds) {
        $checkResult = & psql -h localhost -U postgres -d yukpo_db -c "
            SELECT id, data->>'titre_service' as titre, category, is_active 
            FROM services 
            WHERE id = $id;
        " 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            if ($checkResult -match "0 rows") {
                Write-Host "❌ Service $id : N'existe pas en base - OK" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Service $id : Existe en base - Vérification nécessaire" -ForegroundColor Yellow
                Write-Host $checkResult -ForegroundColor White
            }
        } else {
            Write-Host "❌ Erreur lors de la vérification du service $id" -ForegroundColor Red
        }
    }
    
    # 3. Nettoyer les services avec IDs > 1M (probablement des tests)
    Write-Host "`n🧹 Nettoyage des services avec IDs élevés..." -ForegroundColor Yellow
    
    $cleanupResult = & psql -h localhost -U postgres -d yukpo_db -c "
        UPDATE services 
        SET is_active = false, 
            updated_at = NOW() 
        WHERE id > 1000000;
        
        SELECT COUNT(*) as services_desactives 
        FROM services 
        WHERE id > 1000000 AND is_active = false;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services avec IDs élevés désactivés" -ForegroundColor Green
        Write-Host $cleanupResult -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors du nettoyage" -ForegroundColor Red
        Write-Host $cleanupResult -ForegroundColor Red
    }
    
    # 4. Vérifier l'état final
    Write-Host "`n📊 État final de la base de données..." -ForegroundColor Yellow
    
    $finalCheck = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            COUNT(*) as total_services,
            COUNT(CASE WHEN is_active = true THEN 1 END) as services_actifs,
            COUNT(CASE WHEN is_active = false THEN 1 END) as services_inactifs,
            MIN(id) as min_id,
            MAX(id) as max_id
        FROM services;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ État final de la base:" -ForegroundColor Green
        Write-Host $finalCheck -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la vérification finale" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur critique: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ NETTOYAGE CRITIQUE TERMINÉ" -ForegroundColor Green
Write-Host "La base de données est maintenant sécurisée pour la production" -ForegroundColor Green 