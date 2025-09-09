# Script de test pour diagnostiquer les résultats de recherche
Write-Host "🔍 Test des résultats de recherche..." -ForegroundColor Green

# Vérifier la base de données
Write-Host "`n📊 Vérification de la base de données:" -ForegroundColor Yellow

try {
    # Compter tous les services
    $result = & psql -h localhost -U postgres -d yukpo_db -c "
        SELECT 
            COUNT(*) as total_services,
            COUNT(CASE WHEN is_active = true THEN 1 END) as services_actifs,
            COUNT(CASE WHEN category = 'Restauration' THEN 1 END) as services_restauration,
            COUNT(CASE WHEN category = 'Plomberie' THEN 1 END) as services_plomberie
        FROM services;
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Statistiques des services:" -ForegroundColor Green
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la requête:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de l'exécution:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n🏁 Script terminé." -ForegroundColor Green 