# Script pour nettoyer les embeddings orphelins dans Pinecone
Write-Host "🧹 Nettoyage des embeddings orphelins dans Pinecone..." -ForegroundColor Green

# Vérifier les services problématiques retournés par l'IA
$problematicIds = @(373989, 275841, 508529, 970545, 609012, 673734, 25920, 862419, 921100)

Write-Host "`n📊 Services problématiques retournés par l'IA:" -ForegroundColor Yellow
foreach ($id in $problematicIds) {
    Write-Host "   - Service $id" -ForegroundColor White
}

Write-Host "`n🔧 Solution: Nettoyer Pinecone des embeddings orphelins" -ForegroundColor Cyan
Write-Host "   Ces services n'existent pas en base de données mais ont des embeddings dans Pinecone" -ForegroundColor Red
Write-Host "   Il faut synchroniser Pinecone avec la base de données" -ForegroundColor Yellow

Write-Host "`n📋 Actions à effectuer:" -ForegroundColor Green
Write-Host "   1. Supprimer les embeddings orphelins de Pinecone" -ForegroundColor White
Write-Host "   2. Recréer les embeddings pour les services existants" -ForegroundColor White
Write-Host "   3. Vérifier la synchronisation" -ForegroundColor White

Write-Host "`n⚠️  ATTENTION: Ce problème explique pourquoi vous obtenez des plombiers au lieu d'électriciens!" -ForegroundColor Red
Write-Host "   Pinecone contient des données obsolètes qui ne correspondent plus à la base de données" -ForegroundColor Yellow 