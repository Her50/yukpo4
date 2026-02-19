# Script de Test de Déploiement
# Date: 2026-02-18
# Objectif: Vérifier que le déploiement fonctionne après mise à jour du secret

$PROJECT = "yukpo-project"
$SERVICE_NAME = "yukpo-backend"
$REGION = "europe-west1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test de Déploiement Cloud Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le service Cloud Run
Write-Host "[1/5] Vérification du service Cloud Run..." -ForegroundColor Yellow
try {
    $service = gcloud run services describe $SERVICE_NAME `
        --region=$REGION `
        --project=$PROJECT `
        --format="json" 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service trouvé: $SERVICE_NAME" -ForegroundColor Green
        Write-Host "   URL: $($service.status.url)" -ForegroundColor Gray
        Write-Host "   Révision actuelle: $($service.status.latestReadyRevisionName)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Service non trouvé" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Vérifier que DATABASE_URL est configuré comme secret
Write-Host "[2/5] Vérification de la configuration DATABASE_URL..." -ForegroundColor Yellow
try {
    $envFrom = gcloud run services describe $SERVICE_NAME `
        --region=$REGION `
        --project=$PROJECT `
        --format="value(spec.template.spec.containers[0].envFrom)" 2>&1
    
    if ($envFrom -match "database-url") {
        Write-Host "✅ DATABASE_URL configuré comme secret (database-url)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ DATABASE_URL peut ne pas être configuré comme secret" -ForegroundColor Yellow
    }
    
    # Vérifier qu'il n'est pas défini comme variable d'environnement
    $envVars = gcloud run services describe $SERVICE_NAME `
        --region=$REGION `
        --project=$PROJECT `
        --format="value(spec.template.spec.containers[0].env)" 2>&1
    
    if ($envVars -match "DATABASE_URL") {
        Write-Host "⚠️ ATTENTION: DATABASE_URL est aussi défini comme variable d'environnement!" -ForegroundColor Yellow
        Write-Host "   Cela peut causer des conflits. Il devrait être uniquement un secret." -ForegroundColor Yellow
    } else {
        Write-Host "✅ DATABASE_URL n'est pas défini comme variable d'environnement" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier la configuration: $_" -ForegroundColor Yellow
}
Write-Host ""

# 3. Vérifier la connexion Cloud SQL
Write-Host "[3/5] Vérification de la connexion Cloud SQL..." -ForegroundColor Yellow
try {
    $cloudSql = gcloud run services describe $SERVICE_NAME `
        --region=$REGION `
        --project=$PROJECT `
        --format="value(metadata.annotations.'run.googleapis.com/cloudsql-instances')" 2>&1
    
    if ($cloudSql -match "yukpo-postgres") {
        Write-Host "✅ Connexion Cloud SQL configurée: $cloudSql" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Connexion Cloud SQL non configurée ou incorrecte" -ForegroundColor Yellow
        Write-Host "   Attendu: yukpo-project:europe-west1:yukpo-postgres" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier la connexion Cloud SQL: $_" -ForegroundColor Yellow
}
Write-Host ""

# 4. Vérifier les logs récents
Write-Host "[4/5] Vérification des logs récents (30 dernières minutes)..." -ForegroundColor Yellow
try {
    $timestamp = (Get-Date).AddMinutes(-30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND timestamp>='$timestamp'" `
        --limit=20 `
        --project=$PROJECT `
        --format="value(timestamp,severity,textPayload)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $logs) {
        Write-Host "✅ Logs récupérés" -ForegroundColor Green
        
        # Analyser les logs
        $errorCount = ($logs | Select-String -Pattern "ERROR|FATAL|password authentication|failed" -CaseSensitive:$false).Count
        $successCount = ($logs | Select-String -Pattern "Socket Unix existe|Connexion PostgreSQL établie|Pool PostgreSQL créé" -CaseSensitive:$false).Count
        
        if ($errorCount -gt 0) {
            Write-Host "   ⚠️ $errorCount erreur(s) détectée(s) dans les logs récents" -ForegroundColor Yellow
            Write-Host "   Dernières erreurs:" -ForegroundColor Gray
            $logs | Select-String -Pattern "ERROR|FATAL|password authentication|failed" -CaseSensitive:$false | Select-Object -First 3 | ForEach-Object {
                Write-Host "     - $_" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ✅ Aucune erreur détectée dans les logs récents" -ForegroundColor Green
        }
        
        if ($successCount -gt 0) {
            Write-Host "   ✅ $successCount message(s) de succès détecté(s)" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️ Aucun log récent trouvé (le service peut ne pas avoir été utilisé récemment)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Impossible de récupérer les logs: $_" -ForegroundColor Yellow
}
Write-Host ""

# 5. Test de connexion HTTP (si le service est accessible)
Write-Host "[5/5] Test de connexion HTTP..." -ForegroundColor Yellow
try {
    $serviceUrl = gcloud run services describe $SERVICE_NAME `
        --region=$REGION `
        --project=$PROJECT `
        --format="value(status.url)" 2>&1
    
    if ($serviceUrl) {
        Write-Host "   Test de l'endpoint /health..." -ForegroundColor Gray
        try {
            $response = Invoke-WebRequest -Uri "$serviceUrl/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "   ✅ Endpoint /health répond: $($response.StatusCode)" -ForegroundColor Green
                Write-Host "   Réponse: $($response.Content)" -ForegroundColor Gray
            } else {
                Write-Host "   ⚠️ Endpoint /health répond avec code: $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ⚠️ Impossible de se connecter à l'endpoint /health: $_" -ForegroundColor Yellow
            Write-Host "   (Cela peut être normal si le service nécessite une authentification)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️ URL du service non disponible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Impossible de tester la connexion HTTP: $_" -ForegroundColor Yellow
}
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Résumé du Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Vérifications terminées" -ForegroundColor Green
Write-Host ""
Write-Host "Si des erreurs sont détectées:" -ForegroundColor Yellow
Write-Host "1. Vérifier que le secret database-url est à jour dans Secret Manager" -ForegroundColor White
Write-Host "2. Redéployer le service Cloud Run si nécessaire" -ForegroundColor White
Write-Host "3. Attendre 1-2 minutes après le redéploiement" -ForegroundColor White
Write-Host "4. Vérifier les logs à nouveau" -ForegroundColor White
Write-Host ""


