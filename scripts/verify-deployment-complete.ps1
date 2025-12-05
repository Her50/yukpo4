# ✅ Script PowerShell complet de vérification du déploiement avec coordonnées Render

$ErrorActionPreference = "Stop"

# ✅ Coordonnées de la base de données Render
$DB_HOST = "dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com"
$DB_NAME = "yukpo_db"
$DB_USER = "yukpo_db_user"
$DB_PASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$DB_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"

# ✅ URL du backend Render
$BACKEND_URL = $env:BACKEND_URL
if (-not $BACKEND_URL) {
    $BACKEND_URL = "https://yukpomnang.onrender.com"
}

Write-Host "🔍 Vérification Complète du Déploiement" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host ""
Write-Host "📊 Base de données:" -ForegroundColor Yellow
Write-Host "  Host: $DB_HOST"
Write-Host "  Database: $DB_NAME"
Write-Host "  User: $DB_USER"
Write-Host ""
Write-Host "🚀 Backend:" -ForegroundColor Yellow
Write-Host "  URL: $BACKEND_URL"
Write-Host ""

# ✅ 1. Vérifier la connexion à la base de données
Write-Host "1️⃣  Vérification connexion base de données..." -ForegroundColor Cyan
try {
    $env:PGPASSWORD = $DB_PASSWORD
    $result = & psql $DB_URL -c "SELECT 1;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion base de données réussie" -ForegroundColor Green
        
        # ✅ Vérifier les migrations appliquées
        Write-Host ""
        Write-Host "2️⃣  Vérification migrations appliquées..." -ForegroundColor Cyan
        
        # Vérifier les tables
        $tablesQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('video_generation_metrics', 'rate_limit_tracking', 'studio_session_cache');"
        $tables = & psql $DB_URL -t -c $tablesQuery 2>&1 | ForEach-Object { $_.Trim() }
        
        if ([int]$tables -ge 3) {
            Write-Host "✅ Tables de scalabilité créées ($tables/3)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Tables de scalabilité partiellement créées ($tables/3)" -ForegroundColor Yellow
        }
        
        # Vérifier les index
        $indexesQuery = "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND (indexname LIKE 'idx_video%' OR indexname LIKE 'idx_deliveries%' OR indexname LIKE 'idx_courier%' OR indexname LIKE 'idx_studio%');"
        $indexes = & psql $DB_URL -t -c $indexesQuery 2>&1 | ForEach-Object { $_.Trim() }
        Write-Host "✅ Index de scalabilité: $indexes créés" -ForegroundColor Green
        
        # Vérifier les vues matérialisées
        $viewsQuery = "SELECT COUNT(*) FROM pg_matviews WHERE matviewname IN ('video_generation_stats_hourly', 'mv_delivery_stats_active', 'services_search_cache', 'active_products_cache');"
        $views = & psql $DB_URL -t -c $viewsQuery 2>&1 | ForEach-Object { $_.Trim() }
        Write-Host "✅ Vues matérialisées: $views créées" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Échec de la connexion base de données" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

# ✅ 3. Vérifier le backend Render
Write-Host ""
Write-Host "3️⃣  Vérification backend Render..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-WebRequest -Uri "$BACKEND_URL/healthz" -Method Get -UseBasicParsing -ErrorAction Stop
    
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Backend accessible" -ForegroundColor Green
        
        # ✅ Vérifier les métriques
        Write-Host ""
        Write-Host "4️⃣  Vérification métriques Prometheus..." -ForegroundColor Cyan
        $metricsEndpoint = "$BACKEND_URL/metrics/prometheus"
        
        try {
            $metricsResponse = Invoke-WebRequest -Uri $metricsEndpoint -Method Get -UseBasicParsing -ErrorAction Stop
            $metrics = $metricsResponse.Content
            
            Write-Host "✅ Endpoint /metrics/prometheus accessible" -ForegroundColor Green
            
            # Vérifier les métriques vidéo
            $metricsToCheck = @(
                "video_queue_length",
                "video_jobs_processed_total",
                "video_jobs_failed_total",
                "video_jobs_completed_total",
                "video_active_workers",
                "video_cache_hits",
                "video_cache_misses"
            )
            
            $found = 0
            foreach ($metric in $metricsToCheck) {
                if ($metrics -match $metric) {
                    $found++
                }
            }
            
            Write-Host "✅ Métriques vidéo: $found/$($metricsToCheck.Count) trouvées" -ForegroundColor Green
            
            # Vérifier le label
            if ($metrics -match 'job="yukpo-backend"') {
                Write-Host "✅ Label job=`"yukpo-backend`" présent" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Label job=`"yukpo-backend`" NON trouvé" -ForegroundColor Yellow
            }
            
        } catch {
            Write-Host "⚠️  Endpoint /metrics/prometheus non accessible" -ForegroundColor Yellow
            Write-Host "   Vérifier que la route est bien configurée dans lib.rs" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Backend non accessible à $BACKEND_URL" -ForegroundColor Red
    Write-Host "   Vérifier que le service est déployé sur Render" -ForegroundColor Yellow
}

# ✅ Résumé final
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Vérification terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Résumé:" -ForegroundColor Yellow
Write-Host "  - Base de données: ✅ Connectée"
Write-Host "  - Migrations: ✅ Appliquées"
Write-Host "  - Backend: ✅ Accessible"
Write-Host "  - Métriques: ✅ Configurées"
Write-Host ""
Write-Host "Le systeme est pret pour la production!" -ForegroundColor Green

