# Script pour vérifier l'état des services dans la base de données
Write-Host "🔍 Vérification de l'état des services dans la base de données..." -ForegroundColor Green

# Vérifier les services mentionnés dans les logs
$serviceIds = @(939282, 518829, 531974, 862419, 974024, 20977, 742692, 153)

Write-Host "📊 Vérification des services:" -ForegroundColor Yellow
foreach ($id in $serviceIds) {
    Write-Host "   - Service $id" -ForegroundColor White
}

Write-Host "`n🔧 Exécution des requêtes SQL..." -ForegroundColor Cyan

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
        Write-Host "✅ Requête exécutée avec succès:" -ForegroundColor Green
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