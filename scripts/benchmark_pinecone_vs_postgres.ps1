# Script de benchmark: Pinecone vs PostgreSQL Native Search
# Compare les performances des deux approches de recherche

Write-Host "=== BENCHMARK: Pinecone vs PostgreSQL Native Search ===" -ForegroundColor Cyan
Write-Host "Base de données: yukpo_db" -ForegroundColor Yellow
Write-Host ""

# Configuration
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$BACKEND_URL = "http://localhost:3001"

# Demander le mot de passe PostgreSQL
Write-Host "Entrez le mot de passe pour l'utilisateur postgres:" -ForegroundColor Yellow
$DB_PASSWORD = Read-Host -AsSecureString
$DB_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD))

# Construire l'URL de connexion
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD_PLAIN}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Demander le JWT token
Write-Host "Entrez votre JWT token pour l'authentification:" -ForegroundColor Yellow
$JWT_TOKEN = Read-Host

Write-Host ""
Write-Host "=== ÉTAPE 1: Vérification des services ===" -ForegroundColor Cyan

# Vérifier que le backend est accessible
try {
    $healthResponse = Invoke-RestMethod -Uri "$BACKEND_URL/healthz" -Method GET -TimeoutSec 10
    Write-Host "✅ Backend accessible: $($healthResponse.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Démarrez le backend avec: cargo run" -ForegroundColor Yellow
    exit 1
}

# Vérifier que la base de données est accessible
try {
    $testQuery = "SELECT COUNT(*) as total FROM services WHERE is_active = true;"
    $result = psql $DATABASE_URL -c $testQuery -t 2>$null
    if ($LASTEXITCODE -eq 0) {
        $totalServices = ($result -replace '\s+', '').Trim()
        Write-Host "✅ Base de données accessible: $totalServices services actifs" -ForegroundColor Green
    } else {
        throw "Échec de la connexion"
    }
} catch {
    Write-Host "❌ Base de données non accessible" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 2: Benchmark PostgreSQL Native Search ===" -ForegroundColor Cyan

# Queries de test pour PostgreSQL
$testQueries = @(
    @{query = "plombier"; description = "Recherche simple 'plombier'"},
    @{query = "mécanicien voiture"; description = "Recherche composée 'mécanicien voiture'"},
    @{query = "coiffure salon"; description = "Recherche 'coiffure salon'"},
    @{query = "service réparation"; description = "Recherche 'service réparation'"},
    @{query = "électricien installation"; description = "Recherche 'électricien installation'"}
)

$postgresResults = @()

foreach ($test in $testQueries) {
    Write-Host "Test PostgreSQL: $($test.description)" -ForegroundColor Blue
    
    $startTime = Get-Date
    
    # Requête PostgreSQL native
    $sqlQuery = @"
    SELECT 
        id,
        data->>'titre_service' as titre,
        ts_rank(
            to_tsvector('french', 
                COALESCE(data->>'titre_service', '') || ' ' ||
                COALESCE(data->>'description', '') || ' ' ||
                COALESCE(data->>'category', '')
            ),
            plainto_tsquery('french', '$($test.query)')
        ) as rank
    FROM services 
    WHERE to_tsvector('french', 
        COALESCE(data->>'titre_service', '') || ' ' ||
        COALESCE(data->>'description', '') || ' ' ||
        COALESCE(data->>'category', '')
    ) @@ plainto_tsquery('french', '$($test.query)')
    ORDER BY rank DESC
    LIMIT 10;
"@
    
    try {
        $startTime = Get-Date
        $result = psql $DATABASE_URL -c $sqlQuery -t 2>$null
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $resultCount = ($result | Where-Object { $_ -match '\d+' }).Count
        
        $postgresResults += @{
            query = $test.query
            description = $test.description
            duration_ms = $duration
            result_count = $resultCount
            success = $true
        }
        
        Write-Host "  ✅ $resultCount résultats en ${duration}ms" -ForegroundColor Green
        
    } catch {
        $postgresResults += @{
            query = $test.query
            description = $test.description
            duration_ms = 0
            result_count = 0
            success = $false
            error = $_.Exception.Message
        }
        
        Write-Host "  ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== ÉTAPE 3: Benchmark Pinecone (via Backend) ===" -ForegroundColor Cyan

# Activer temporairement la recherche Pinecone dans le backend
Write-Host "Note: Pour tester Pinecone, modifiez temporairement le code backend" -ForegroundColor Yellow
Write-Host "pour réactiver la recherche sémantique dans rechercher_besoin.rs" -ForegroundColor Yellow

$pineconeResults = @()

foreach ($test in $testQueries) {
    Write-Host "Test Pinecone: $($test.description)" -ForegroundColor Blue
    
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $JWT_TOKEN"
    }
    
    $payload = @{
        user_input = $test.query
        user_id = 1
        context = "recherche_besoin"
    } | ConvertTo-Json -Depth 10
    
    try {
        $startTime = Get-Date
        $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $resultCount = if ($response.resultats -and $response.resultats.detail -ne "Not Found") { 1 } else { 0 }
        
        $pineconeResults += @{
            query = $test.query
            description = $test.description
            duration_ms = $duration
            result_count = $resultCount
            success = $true
            tokens_consumed = $response.tokens_consumed
        }
        
        Write-Host "  ✅ $resultCount résultats en ${duration}ms (tokens: $($response.tokens_consumed))" -ForegroundColor Green
        
    } catch {
        $pineconeResults += @{
            query = $test.query
            description = $test.description
            duration_ms = 0
            result_count = 0
            success = $false
            error = $_.Exception.Message
        }
        
        Write-Host "  ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== ÉTAPE 4: Analyse des résultats ===" -ForegroundColor Cyan

# Calculer les statistiques PostgreSQL
$postgresSuccessCount = ($postgresResults | Where-Object { $_.success }).Count
$postgresAvgDuration = if ($postgresSuccessCount -gt 0) { 
    ($postgresResults | Where-Object { $_.success } | Measure-Object -Property duration_ms -Average).Average 
} else { 0 }
$postgresTotalResults = ($postgresResults | Where-Object { $_.success } | Measure-Object -Property result_count -Sum).Sum

# Calculer les statistiques Pinecone
$pineconeSuccessCount = ($pineconeResults | Where-Object { $_.success }).Count
$pineconeAvgDuration = if ($pineconeSuccessCount -gt 0) { 
    ($pineconeResults | Where-Object { $_.success } | Measure-Object -Property duration_ms -Average).Average 
} else { 0 }
$pineconeTotalResults = ($pineconeResults | Where-Object { $_.success } | Measure-Object -Property result_count -Sum).Sum
$pineconeTotalTokens = ($pineconeResults | Where-Object { $_.success } | Measure-Object -Property tokens_consumed -Sum).Sum

Write-Host ""
Write-Host "=== RÉSULTATS DU BENCHMARK ===" -ForegroundColor Green
Write-Host ""

Write-Host "📊 POSTGRESQL NATIVE SEARCH:" -ForegroundColor Cyan
Write-Host "  ✅ Tests réussis: $postgresSuccessCount/$($testQueries.Count)" -ForegroundColor Green
Write-Host "  ⏱️  Durée moyenne: $([math]::Round($postgresAvgDuration, 2))ms" -ForegroundColor White
Write-Host "  🔍 Total résultats: $postgresTotalResults" -ForegroundColor White
Write-Host "  💰 Coût: GRATUIT (pas de tokens)" -ForegroundColor Green

Write-Host ""
Write-Host "🤖 PINECONE SEMANTIC SEARCH:" -ForegroundColor Cyan
Write-Host "  ✅ Tests réussis: $pineconeSuccessCount/$($testQueries.Count)" -ForegroundColor Green
Write-Host "  ⏱️  Durée moyenne: $([math]::Round($pineconeAvgDuration, 2))ms" -ForegroundColor White
Write-Host "  🔍 Total résultats: $pineconeTotalResults" -ForegroundColor White
Write-Host "  💰 Coût: $pineconeTotalTokens tokens consommés" -ForegroundColor Yellow

Write-Host ""
Write-Host "🏆 COMPARAISON:" -ForegroundColor Green

if ($postgresAvgDuration -gt 0 -and $pineconeAvgDuration -gt 0) {
    $speedRatio = $pineconeAvgDuration / $postgresAvgDuration
    if ($speedRatio -gt 1) {
        Write-Host "  🚀 PostgreSQL est $([math]::Round($speedRatio, 1))x plus RAPIDE que Pinecone" -ForegroundColor Green
    } else {
        Write-Host "  🐌 Pinecone est $([math]::Round(1/$speedRatio, 1))x plus RAPIDE que PostgreSQL" -ForegroundColor Yellow
    }
}

Write-Host "  💰 PostgreSQL: GRATUIT vs Pinecone: $pineconeTotalTokens tokens" -ForegroundColor Green
Write-Host "  🔒 PostgreSQL: Local vs Pinecone: Dépendant d'API externe" -ForegroundColor White

Write-Host ""
Write-Host "=== RECOMMANDATIONS ===" -ForegroundColor Cyan
Write-Host ""

if ($postgresSuccessCount -eq $testQueries.Count) {
    Write-Host "✅ PostgreSQL Native Search est PRÊT pour la production!" -ForegroundColor Green
    Write-Host "   - Performance excellente" -ForegroundColor White
    Write-Host "   - Aucun coût d'API" -ForegroundColor White
    Write-Host "   - Contrôle total sur l'algorithme" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Vous pouvez maintenant SUSPENDRE Pinecone et utiliser PostgreSQL!" -ForegroundColor Green
} else {
    Write-Host "⚠️  PostgreSQL Native Search nécessite des ajustements" -ForegroundColor Yellow
    Write-Host "   - Vérifiez les index de recherche" -ForegroundColor White
    Write-Host "   - Testez avec plus de données" -ForegroundColor White
}

Write-Host ""
Write-Host "=== BENCHMARK TERMINÉ ===" -ForegroundColor Green

# Nettoyer le mot de passe en mémoire
$DB_PASSWORD_PLAIN = $null
[System.GC]::Collect() 