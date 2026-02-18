# 🔍 Script de Diagnostic - Connexion GCP Cloud Run
# Identifie rapidement les problèmes de connexion après migration vers GCP

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceName = "yukpo-backend",
    [string]$Region = "europe-west1",
    [string]$CloudSqlInstance = "yukpo-postgres"
)

Write-Host "🔍 Diagnostic GCP Cloud Run - Connexion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = @()
$warnings = @()
$success = @()

# 1. Vérifier que gcloud est installé
Write-Host "1️⃣ Vérification de gcloud CLI..." -ForegroundColor Yellow
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "   ✅ gcloud installé: $gcloudVersion" -ForegroundColor Green
    $success += "gcloud CLI installé"
} catch {
    Write-Host "   ❌ gcloud non installé ou non dans PATH" -ForegroundColor Red
    $errors += "gcloud CLI non disponible"
    exit 1
}

# 2. Vérifier l'authentification
Write-Host ""
Write-Host "2️⃣ Vérification de l'authentification GCP..." -ForegroundColor Yellow
try {
    $currentAccount = gcloud config get-value account 2>&1
    if ($LASTEXITCODE -eq 0 -and $currentAccount) {
        Write-Host "   ✅ Authentifié comme: $currentAccount" -ForegroundColor Green
        $success += "Authentification GCP OK"
    } else {
        Write-Host "   ❌ Non authentifié" -ForegroundColor Red
        $errors += "Authentification GCP manquante"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification de l'authentification" -ForegroundColor Red
    $errors += "Impossible de vérifier l'authentification"
}

# 3. Vérifier que le projet existe
Write-Host ""
Write-Host "3️⃣ Vérification du projet GCP..." -ForegroundColor Yellow
try {
    $projectInfo = gcloud projects describe $ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Projet $ProjectId existe" -ForegroundColor Green
        $success += "Projet GCP existe"
    } else {
        Write-Host "   ❌ Projet $ProjectId non trouvé" -ForegroundColor Red
        $errors += "Projet GCP non trouvé: $ProjectId"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification du projet" -ForegroundColor Red
    $errors += "Impossible de vérifier le projet"
}

# 4. Vérifier que le service Cloud Run existe
Write-Host ""
Write-Host "4️⃣ Vérification du service Cloud Run..." -ForegroundColor Yellow
try {
    $serviceInfo = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(status.url)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $serviceInfo) {
        Write-Host "   ✅ Service $ServiceName existe" -ForegroundColor Green
        Write-Host "   📍 URL: $serviceInfo" -ForegroundColor Cyan
        $success += "Service Cloud Run existe"
        
        # Tester la connexion
        Write-Host "   🔍 Test de connexion..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "$serviceInfo/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "   ✅ Service répond sur /health" -ForegroundColor Green
                $success += "Service répond aux requêtes"
            } else {
                Write-Host "   ⚠️ Service répond mais avec code: $($response.StatusCode)" -ForegroundColor Yellow
                $warnings += "Service répond avec code non-200: $($response.StatusCode)"
            }
        } catch {
            Write-Host "   ❌ Impossible de se connecter au service" -ForegroundColor Red
            Write-Host "      Erreur: $($_.Exception.Message)" -ForegroundColor Red
            $errors += "Service ne répond pas: $($_.Exception.Message)"
        }
    } else {
        Write-Host "   ❌ Service $ServiceName non trouvé dans la région $Region" -ForegroundColor Red
        $errors += "Service Cloud Run non trouvé"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification du service" -ForegroundColor Red
    $errors += "Impossible de vérifier le service Cloud Run"
}

# 5. Vérifier l'instance Cloud SQL
Write-Host ""
Write-Host "5️⃣ Vérification de l'instance Cloud SQL..." -ForegroundColor Yellow
try {
    $sqlInfo = gcloud sql instances describe $CloudSqlInstance `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Instance Cloud SQL $CloudSqlInstance existe" -ForegroundColor Green
        $success += "Instance Cloud SQL existe"
        
        # Vérifier l'état
        $sqlState = gcloud sql instances describe $CloudSqlInstance `
            --project=$ProjectId `
            --format="value(state)" 2>&1
        
        if ($sqlState -eq "RUNNABLE") {
            Write-Host "   ✅ Instance en état RUNNABLE" -ForegroundColor Green
            $success += "Instance Cloud SQL opérationnelle"
        } else {
            Write-Host "   ⚠️ Instance en état: $sqlState" -ForegroundColor Yellow
            $warnings += "Instance Cloud SQL en état: $sqlState"
        }
    } else {
        Write-Host "   ❌ Instance Cloud SQL $CloudSqlInstance non trouvée" -ForegroundColor Red
        $errors += "Instance Cloud SQL non trouvée: $CloudSqlInstance"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification de Cloud SQL" -ForegroundColor Red
    $errors += "Impossible de vérifier Cloud SQL"
}

# 6. Vérifier la connexion Cloud SQL dans Cloud Run
Write-Host ""
Write-Host "6️⃣ Vérification de la connexion Cloud SQL dans Cloud Run..." -ForegroundColor Yellow
try {
    $cloudSqlConnection = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances')" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        if ($cloudSqlConnection) {
            Write-Host "   ✅ Connexion Cloud SQL configurée: $cloudSqlConnection" -ForegroundColor Green
            $success += "Connexion Cloud SQL configurée"
            
            # Vérifier que c'est la bonne instance
            $expectedConnection = "$ProjectId`:$Region`:$CloudSqlInstance"
            if ($cloudSqlConnection -eq $expectedConnection) {
                Write-Host "   ✅ Instance correcte" -ForegroundColor Green
                $success += "Instance Cloud SQL correcte"
            } else {
                Write-Host "   ⚠️ Instance différente de celle attendue" -ForegroundColor Yellow
                Write-Host "      Attendu: $expectedConnection" -ForegroundColor Yellow
                Write-Host "      Trouvé: $cloudSqlConnection" -ForegroundColor Yellow
                $warnings += "Instance Cloud SQL différente de celle attendue"
            }
        } else {
            Write-Host "   ❌ Aucune connexion Cloud SQL configurée" -ForegroundColor Red
            $errors += "Connexion Cloud SQL non configurée dans Cloud Run"
        }
    } else {
        Write-Host "   ❌ Erreur lors de la vérification de la connexion Cloud SQL" -ForegroundColor Red
        $errors += "Impossible de vérifier la connexion Cloud SQL"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification" -ForegroundColor Red
    $errors += "Impossible de vérifier la connexion Cloud SQL"
}

# 7. Vérifier les secrets dans Secret Manager
Write-Host ""
Write-Host "7️⃣ Vérification des secrets dans Secret Manager..." -ForegroundColor Yellow
$requiredSecrets = @("jwt-secret", "database-url", "redis-url", "mongodb-url")
$missingSecrets = @()

foreach ($secretName in $requiredSecrets) {
    try {
        $secretInfo = gcloud secrets describe $secretName `
            --project=$ProjectId 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Secret $secretName existe" -ForegroundColor Green
            $success += "Secret $secretName existe"
        } else {
            Write-Host "   ❌ Secret $secretName non trouvé" -ForegroundColor Red
            $missingSecrets += $secretName
            $errors += "Secret manquant: $secretName"
        }
    } catch {
        Write-Host "   ❌ Erreur lors de la vérification du secret $secretName" -ForegroundColor Red
        $missingSecrets += $secretName
        $errors += "Impossible de vérifier le secret: $secretName"
    }
}

# 8. Vérifier les variables d'environnement
Write-Host ""
Write-Host "8️⃣ Vérification des variables d'environnement..." -ForegroundColor Yellow
try {
    $envVars = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="yaml(spec.template.spec.containers[0].env)" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Variables d'environnement récupérées" -ForegroundColor Green
        
        # Vérifier CLOUD_RUN
        if ($envVars -match "CLOUD_RUN") {
            Write-Host "   ✅ CLOUD_RUN défini" -ForegroundColor Green
            $success += "Variable CLOUD_RUN définie"
        } else {
            Write-Host "   ⚠️ CLOUD_RUN non défini" -ForegroundColor Yellow
            $warnings += "Variable CLOUD_RUN non définie"
        }
        
        # Vérifier PORT (Cloud Run le définit automatiquement)
        if ($envVars -match "PORT") {
            Write-Host "   ✅ PORT défini" -ForegroundColor Green
            $success += "Variable PORT définie"
        } else {
            Write-Host "   ⚠️ PORT non défini (Cloud Run devrait le définir automatiquement)" -ForegroundColor Yellow
            $warnings += "Variable PORT non définie"
        }
    } else {
        Write-Host "   ❌ Erreur lors de la récupération des variables d'environnement" -ForegroundColor Red
        $errors += "Impossible de récupérer les variables d'environnement"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification" -ForegroundColor Red
    $errors += "Impossible de vérifier les variables d'environnement"
}

# 9. Vérifier le service account
Write-Host ""
Write-Host "9️⃣ Vérification du service account..." -ForegroundColor Yellow
try {
    $serviceAccount = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.spec.serviceAccountName)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
        Write-Host "   ✅ Service account: $serviceAccount" -ForegroundColor Green
        $success += "Service account configuré"
        
        # Vérifier les permissions (approximatif)
        Write-Host "   🔍 Vérification des permissions IAM..." -ForegroundColor Yellow
        $iamPolicy = gcloud projects get-iam-policy $ProjectId `
            --flatten="bindings[].members" `
            --filter="bindings.members:serviceAccount:$serviceAccount" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            if ($iamPolicy -match "cloudsql.client") {
                Write-Host "   ✅ Permission cloudsql.client accordée" -ForegroundColor Green
                $success += "Permission cloudsql.client OK"
            } else {
                Write-Host "   ⚠️ Permission cloudsql.client non trouvée" -ForegroundColor Yellow
                $warnings += "Permission cloudsql.client peut manquer"
            }
            
            if ($iamPolicy -match "secretmanager.secretAccessor") {
                Write-Host "   ✅ Permission secretmanager.secretAccessor accordée" -ForegroundColor Green
                $success += "Permission secretmanager.secretAccessor OK"
            } else {
                Write-Host "   ⚠️ Permission secretmanager.secretAccessor non trouvée" -ForegroundColor Yellow
                $warnings += "Permission secretmanager.secretAccessor peut manquer"
            }
        }
    } else {
        Write-Host "   ⚠️ Service account non configuré (utilise le compte par défaut)" -ForegroundColor Yellow
        $warnings += "Service account non configuré explicitement"
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification du service account" -ForegroundColor Red
    $errors += "Impossible de vérifier le service account"
}

# 10. Vérifier les logs récents
Write-Host ""
Write-Host "🔟 Vérification des logs récents..." -ForegroundColor Yellow
try {
    Write-Host "   🔍 Récupération des 10 dernières lignes de logs..." -ForegroundColor Cyan
    $logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName" `
        --limit=10 `
        --project=$ProjectId `
        --format="table(timestamp,severity,textPayload)" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $logs -ForegroundColor Gray
        
        # Rechercher des erreurs critiques
        if ($logs -match "ERREUR|ERROR|Failed|failed") {
            Write-Host "   ⚠️ Erreurs détectées dans les logs" -ForegroundColor Yellow
            $warnings += "Erreurs détectées dans les logs récents"
        } else {
            Write-Host "   ✅ Aucune erreur critique dans les logs récents" -ForegroundColor Green
            $success += "Logs récents sans erreur critique"
        }
    } else {
        Write-Host "   ⚠️ Impossible de récupérer les logs" -ForegroundColor Yellow
        $warnings += "Impossible de récupérer les logs"
    }
} catch {
    Write-Host "   ⚠️ Erreur lors de la récupération des logs" -ForegroundColor Yellow
    $warnings += "Erreur lors de la récupération des logs"
}

# Résumé
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "✅ Succès ($($success.Count)):" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "   - $item" -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️ Avertissements ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "   - $item" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "❌ Erreurs ($($errors.Count)):" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host "   - $item" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "🔧 ACTIONS RECOMMANDÉES:" -ForegroundColor Cyan
    Write-Host ""
    
    if ($errors -match "Service Cloud Run non trouvé") {
        Write-Host "   1. Déployer le service Cloud Run:" -ForegroundColor Yellow
        Write-Host "      gcloud run deploy $ServiceName --source . --region=$Region --project=$ProjectId" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($errors -match "Instance Cloud SQL non trouvée") {
        Write-Host "   2. Créer l'instance Cloud SQL ou vérifier le nom:" -ForegroundColor Yellow
        Write-Host "      gcloud sql instances list --project=$ProjectId" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($errors -match "Connexion Cloud SQL non configurée") {
        Write-Host "   3. Ajouter la connexion Cloud SQL:" -ForegroundColor Yellow
        Write-Host "      gcloud run services update $ServiceName --add-cloudsql-instances=$ProjectId`:$Region`:$CloudSqlInstance --region=$Region --project=$ProjectId" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($missingSecrets.Count -gt 0) {
        Write-Host "   4. Créer les secrets manquants:" -ForegroundColor Yellow
        foreach ($secret in $missingSecrets) {
            Write-Host "      echo -n 'VALEUR' | gcloud secrets create $secret --data-file=- --project=$ProjectId" -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    Write-Host "   📖 Consulter AUDIT_PROFOND_CONNEXION_GCP.md pour plus de détails" -ForegroundColor Cyan
    Write-Host ""
    
    exit 1
} else {
    Write-Host "✅ Aucune erreur critique détectée!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Si le problème persiste, consultez les logs détaillés:" -ForegroundColor Cyan
    Write-Host "   gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName' --limit=50 --project=$ProjectId" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

