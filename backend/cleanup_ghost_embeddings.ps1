# Script de nettoyage des embeddings fantômes dans Pinecone
# Supprime les embeddings des services qui n'existent plus en base

Write-Host "🔍 Nettoyage des embeddings fantômes..." -ForegroundColor Cyan

# Configuration
$backendUrl = "http://localhost:3000"
$embeddingUrl = "http://localhost:8000"
$apiKey = "yukpo_embedding_key_2024"

# Services fantômes identifiés dans les logs (retournent 404)
$ghostServiceIds = @(862419, 20977, 518829, 939282, 742692)

Write-Host "📊 Services fantômes à vérifier: $($ghostServiceIds -join ', ')" -ForegroundColor Yellow

foreach ($serviceId in $ghostServiceIds) {
    Write-Host "`n🔍 Vérification du service $serviceId..." -ForegroundColor Gray
    
    try {
        # Vérifier si le service existe via l'API backend
        $response = Invoke-RestMethod -Uri "$backendUrl/api/services/$serviceId" -Method GET -ErrorAction SilentlyContinue
        
        if ($response) {
            Write-Host "✅ Service $serviceId: EXISTE en base" -ForegroundColor Green
        }
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "❌ Service $serviceId: N'EXISTE PAS en base - Suppression de Pinecone" -ForegroundColor Red
            
            try {
                # Supprimer l'embedding de Pinecone
                $deleteBody = @{
                    service_id = $serviceId
                } | ConvertTo-Json
                
                $deleteResponse = Invoke-RestMethod -Uri "$embeddingUrl/delete_embedding_pinecone" -Method POST -Body $deleteBody -ContentType "application/json" -Headers @{"x-api-key" = $apiKey}
                
                Write-Host "   🗑️  Embedding supprimé de Pinecone: $($deleteResponse | ConvertTo-Json)" -ForegroundColor Green
            }
            catch {
                Write-Host "   ⚠️  Erreur suppression embedding: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "⚠️  Erreur vérification service $serviceId: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n📈 Statistiques après nettoyage:" -ForegroundColor Cyan

try {
    # Compter les services actifs
    $statsResponse = Invoke-RestMethod -Uri "$backendUrl/api/services/stats" -Method GET -ErrorAction SilentlyContinue
    
    if ($statsResponse) {
        Write-Host "   Total des services: $($statsResponse.total)" -ForegroundColor White
        Write-Host "   Services actifs: $($statsResponse.active)" -ForegroundColor White
    }
}
catch {
    Write-Host "   ⚠️  Impossible de récupérer les statistiques" -ForegroundColor Yellow
}

Write-Host "`n🎯 Nettoyage terminé !" -ForegroundColor Green
Write-Host "   Les embeddings fantômes ont été supprimés de Pinecone." -ForegroundColor White
Write-Host "   Seuls les services existants en base seront retournés." -ForegroundColor White 