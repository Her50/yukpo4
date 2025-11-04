# Test de la route de diagnostic via le backend déployé
# Date: 2025-11-04

Write-Host "🔍 TEST DIAGNOSTIC - AUTOCOMPLETE_COMBINATIONS" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "📡 Appel de l'API de diagnostic..." -ForegroundColor Yellow
    $url = "https://yukpomnang.onrender.com/api/diagnostic/autocomplete-table"
    
    $response = Invoke-RestMethod -Uri $url -Method GET -ErrorAction Stop
    
    Write-Host "✅ Réponse reçue !" -ForegroundColor Green
    Write-Host ""
    
    # Affichage formaté
    Write-Host "📊 RÉSULTATS :" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    
    Write-Host "Table existe          : " -NoNewline
    Write-Host $response.table_exists -ForegroundColor $(if ($response.table_exists) { "Green" } else { "Red" })
    
    Write-Host "Colonne product_labels: " -NoNewline
    Write-Host $response.has_product_labels -ForegroundColor $(if ($response.has_product_labels) { "Green" } else { "Red" })
    
    Write-Host "Colonne location_labels: " -NoNewline
    Write-Host $response.has_location_labels -ForegroundColor $(if ($response.has_location_labels) { "Green" } else { "Red" })
    
    Write-Host ""
    Write-Host "Total enregistrements : " -NoNewline
    Write-Host $response.total_rows -ForegroundColor $(if ($response.total_rows -gt 0) { "Green" } else { "Yellow" })
    
    Write-Host "Produits populaires   : " -NoNewline
    Write-Host $response.popular_products -ForegroundColor $(if ($response.popular_products -gt 0) { "Green" } else { "Yellow" })
    
    Write-Host "Préférés IA           : " -NoNewline
    Write-Host $response.ai_preferred -ForegroundColor $(if ($response.ai_preferred -gt 0) { "Green" } else { "Yellow" })
    
    if ($response.max_usage_count) {
        Write-Host "Max usage_count       : " -NoNewline
        Write-Host $response.max_usage_count -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "📋 Colonnes disponibles ($($response.columns.Count)) :" -ForegroundColor Cyan
    $response.columns | ForEach-Object { Write-Host "   • $_" -ForegroundColor Gray }
    
    if ($response.sample_products -and $response.sample_products.Count -gt 0) {
        Write-Host ""
        Write-Host "📦 Exemples de produits :" -ForegroundColor Cyan
        $response.sample_products | ForEach-Object {
            Write-Host "   • $($_.product_vector -join ' • ') (usage: $($_.usage_count))" -ForegroundColor White
        }
    } else {
        Write-Host ""
        Write-Host "⚠️ AUCUN PRODUIT DANS LA TABLE - Table vide !" -ForegroundColor Yellow
        Write-Host "   💡 La table se remplit automatiquement quand l'IA génère des produits" -ForegroundColor Gray
    }
    
    if ($response.migrations_applied -and $response.migrations_applied.Count -gt 0) {
        Write-Host ""
        Write-Host "✅ Migrations appliquées :" -ForegroundColor Cyan
        $response.migrations_applied | ForEach-Object { Write-Host "   • $_" -ForegroundColor Gray }
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    
} catch {
    Write-Host "❌ ERREUR : $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Possible raisons :" -ForegroundColor Yellow
    Write-Host "   1. La route /api/diagnostic/autocomplete-table n'est pas encore déployée" -ForegroundColor Gray
    Write-Host "   2. Le backend n'est pas accessible" -ForegroundColor Gray
    Write-Host "   3. Erreur de connexion réseau" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🔧 Solution : Déployez d'abord le backend avec la nouvelle route" -ForegroundColor Cyan
}

