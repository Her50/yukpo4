# Script de nettoyage des embeddings Pinecone fantômes
# Supprime les embeddings pour des services qui n'existent plus en base

Write-Host "🧹 Nettoyage des embeddings Pinecone fantômes..." -ForegroundColor Cyan

$backendUrl = "http://localhost:3001"
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNjUwOSwiaWF0IjoxNzU2NTAwNzI5LCJleHAiOjE3NTY1ODcxMjl9.BhhEqeVm_SfPk24N8_s84byPlB_2N0PLhi-50gntx60"

# Services fantômes identifiés dans les logs
$ghostServiceIds = @(974024, 20977, 862419, 939282, 518829, 742692)

Write-Host "`n📋 Services fantômes identifiés:" -ForegroundColor Yellow
foreach ($serviceId in $ghostServiceIds) {
    Write-Host "   - Service $serviceId" -ForegroundColor Red
}

Write-Host "`n🔍 Vérification de l'existence en base..." -ForegroundColor Cyan

foreach ($serviceId in $ghostServiceIds) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$backendUrl/api/services/$serviceId" -Method GET -Headers $headers
        
        Write-Host "✅ Service $serviceId: EXISTE en base" -ForegroundColor Green
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 404) {
            Write-Host "❌ Service $serviceId: N'EXISTE PAS en base (404)" -ForegroundColor Red
        } else {
            Write-Host "⚠️ Service $serviceId: Erreur $statusCode" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n💡 Recommandations:" -ForegroundColor Cyan
Write-Host "   1. Ces services fantômes proviennent de Pinecone" -ForegroundColor White
Write-Host "   2. Ils correspondent à des services supprimés ou jamais créés" -ForegroundColor White
Write-Host "   3. Il faut nettoyer Pinecone pour supprimer ces embeddings" -ForegroundColor White
Write-Host "   4. Ou créer un filtre côté backend pour ignorer les services inexistants" -ForegroundColor White

Write-Host "`n🎯 Solution immédiate:" -ForegroundColor Green
Write-Host "   - Modifier le backend pour filtrer les services inexistants" -ForegroundColor White
Write-Host "   - Ou nettoyer Pinecone des embeddings fantômes" -ForegroundColor White 