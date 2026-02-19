# Script de Configuration DNS Privé pour Redis Memorystore
# Date: 2026-02-19
# Objectif: Configurer un DNS privé GCP pour résoudre le problème de connexion Redis

$PROJECT = "yukpo-project"
$REGION = "europe-west1"
$SECRET_REDIS = "redis-url"
$SERVICE = "yukpo-backend"
$ZONE_NAME = "redis-zone"
$DNS_NAME = "redis.internal"
$REDIS_HOSTNAME = "yukpo-redis.redis.internal."
$REDIS_IP = "10.128.102.19"
$REDIS_PORT = "6379"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration DNS Privé pour Redis Memorystore" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Ce script va configurer un DNS privé GCP pour résoudre le problème de connexion Redis." -ForegroundColor Yellow
Write-Host "Le problème: Le client Redis Rust essaie de faire une résolution DNS de l'IP privée, ce qui échoue." -ForegroundColor Yellow
Write-Host "La solution: Créer un DNS privé qui mappe un nom d'hôte à l'IP Redis." -ForegroundColor Yellow
Write-Host ""

# 1. Vérifier l'instance Redis
Write-Host "[1/6] Vérification de l'instance Redis..." -ForegroundColor Yellow
$redisInfo = gcloud redis instances describe yukpo-redis --region=$REGION --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Instance Redis trouvée: yukpo-redis" -ForegroundColor Green
    Write-Host "   IP: $($redisInfo.host)" -ForegroundColor Gray
    Write-Host "   Port: $($redisInfo.port)" -ForegroundColor Gray
    Write-Host "   État: $($redisInfo.state)" -ForegroundColor Gray
    
    # Utiliser l'IP réelle de l'instance
    if ($redisInfo.host) {
        $REDIS_IP = $redisInfo.host
        Write-Host "   ✅ IP mise à jour: $REDIS_IP" -ForegroundColor Green
    }
}
else {
    Write-Host "❌ Instance Redis non trouvée!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Vérifier si la zone DNS existe déjà
Write-Host "[2/6] Vérification de la zone DNS privée..." -ForegroundColor Yellow
$zoneOutput = gcloud dns managed-zones describe $ZONE_NAME --project=$PROJECT --format="json" 2>&1
$existingZone = $null
if ($LASTEXITCODE -eq 0 -and $zoneOutput -notmatch "ERROR") {
    try {
        $existingZone = $zoneOutput | ConvertFrom-Json
    } catch {
        $existingZone = $null
    }
}
if ($existingZone) {
    Write-Host "⚠️ Zone DNS '$ZONE_NAME' existe déjà" -ForegroundColor Yellow
    Write-Host "   DNS Name: $($existingZone.dnsName)" -ForegroundColor Gray
    Write-Host "   Visibilité: $($existingZone.visibility)" -ForegroundColor Gray
    
    # Continuer automatiquement pour mettre à jour l'enregistrement
    Write-Host "   ✅ Continuation automatique pour mettre à jour l'enregistrement" -ForegroundColor Green
}
else {
    Write-Host "✅ Zone DNS n'existe pas, création..." -ForegroundColor Green
    
    # Créer la zone DNS privée
    Write-Host "   Création de la zone DNS privée '$ZONE_NAME'..." -ForegroundColor Gray
    $result = gcloud dns managed-zones create $ZONE_NAME `
        --dns-name=$DNS_NAME `
        --description="Zone DNS privée pour Redis Memorystore" `
        --visibility=private `
        --networks=default `
        --project=$PROJECT 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Zone DNS créée avec succès" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors de la création de la zone DNS" -ForegroundColor Red
        Write-Host "Erreur: $result" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# 3. Vérifier si l'enregistrement A existe déjà
Write-Host "[3/6] Vérification de l'enregistrement DNS..." -ForegroundColor Yellow
$recordOutput = gcloud dns record-sets describe $REDIS_HOSTNAME `
    --zone=$ZONE_NAME `
    --type=A `
    --project=$PROJECT `
    --format="json" 2>&1
$existingRecord = $null
if ($LASTEXITCODE -eq 0 -and $recordOutput -notmatch "ERROR") {
    try {
        $existingRecord = $recordOutput | ConvertFrom-Json
    } catch {
        $existingRecord = $null
    }
}

if ($existingRecord) {
    Write-Host "⚠️ Enregistrement DNS existe déjà" -ForegroundColor Yellow
    Write-Host "   Nom: $REDIS_HOSTNAME" -ForegroundColor Gray
    Write-Host "   IP actuelle: $($existingRecord.rrdatas -join ', ')" -ForegroundColor Gray
    
    if ($existingRecord.rrdatas -contains $REDIS_IP) {
        Write-Host "   ✅ IP déjà correcte" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️ IP différente, mise à jour nécessaire" -ForegroundColor Yellow
        
        # Supprimer l'ancien enregistrement
        Write-Host "   Suppression de l'ancien enregistrement..." -ForegroundColor Gray
        gcloud dns record-sets delete $REDIS_HOSTNAME `
            --zone=$ZONE_NAME `
            --type=A `
            --project=$PROJECT `
            --quiet 2>&1 | Out-Null
        
        # Créer le nouvel enregistrement
        Write-Host "   Création du nouvel enregistrement..." -ForegroundColor Gray
        $result = gcloud dns record-sets create $REDIS_HOSTNAME `
            --zone=$ZONE_NAME `
            --rrdatas=$REDIS_IP `
            --type=A `
            --ttl=300 `
            --project=$PROJECT 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Enregistrement DNS mis à jour" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
            Write-Host "Erreur: $result" -ForegroundColor Red
            exit 1
        }
    }
}
else {
    Write-Host "✅ Enregistrement DNS n'existe pas, création..." -ForegroundColor Green
    
    # Créer l'enregistrement A
    $result = gcloud dns record-sets create $REDIS_HOSTNAME `
        --zone=$ZONE_NAME `
        --rrdatas=$REDIS_IP `
        --type=A `
        --ttl=300 `
        --project=$PROJECT 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Enregistrement DNS créé avec succès" -ForegroundColor Green
        Write-Host "   Nom: $REDIS_HOSTNAME" -ForegroundColor Gray
        Write-Host "   IP: $REDIS_IP" -ForegroundColor Gray
        Write-Host "   TTL: 300 secondes" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Erreur lors de la création de l'enregistrement DNS" -ForegroundColor Red
        Write-Host "Erreur: $result" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# 4. Construire la nouvelle REDIS_URL avec le nom d'hôte (sans point final)
Write-Host "[4/6] Construction de la nouvelle REDIS_URL..." -ForegroundColor Yellow
$REDIS_HOSTNAME_CLEAN = $REDIS_HOSTNAME.TrimEnd('.')
$NEW_REDIS_URL = "redis://${REDIS_HOSTNAME_CLEAN}:${REDIS_PORT}/0"
Write-Host "✅ Nouvelle REDIS_URL: $NEW_REDIS_URL" -ForegroundColor Green
Write-Host ""

# 5. Mettre à jour le secret GCP
Write-Host "[5/6] Mise à jour du secret '$SECRET_REDIS'..." -ForegroundColor Yellow
try {
    $tempFile = [System.IO.Path]::GetTempFileName()
    $NEW_REDIS_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    $result = gcloud secrets versions add $SECRET_REDIS `
        --data-file=$tempFile `
        --project=$PROJECT 2>&1
    
    Remove-Item $tempFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret REDIS_URL mis à jour" -ForegroundColor Green
        if ($result -match 'version (\d+)') {
            Write-Host "   Version: $($matches[1])" -ForegroundColor Gray
        }
        Write-Host "   URL: $NEW_REDIS_URL" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
        Write-Host "Erreur: $result" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 6. Redéployer Cloud Run
Write-Host "[6/6] Redéploiement du service Cloud Run..." -ForegroundColor Yellow
try {
    $result = gcloud run services update $SERVICE `
        --region=$REGION `
        --project=$PROJECT `
        --update-env-vars="REDIS_DNS_UPDATED=$(Get-Date -Format 'yyyy-MM-dd-HHmmss')" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service Cloud Run redéployé" -ForegroundColor Green
        Write-Host "   Les nouveaux secrets seront chargés au prochain démarrage" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️ Erreur lors du redéploiement" -ForegroundColor Yellow
        Write-Host "Erreur: $result" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Erreur: $_" -ForegroundColor Yellow
}
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Résumé des actions:" -ForegroundColor Yellow
Write-Host "  ✅ Zone DNS privée: $ZONE_NAME ($DNS_NAME)" -ForegroundColor Green
Write-Host "  ✅ Enregistrement DNS: $REDIS_HOSTNAME → $REDIS_IP" -ForegroundColor Green
Write-Host "  ✅ Secret REDIS_URL mis à jour: $NEW_REDIS_URL" -ForegroundColor Green
Write-Host "  ✅ Service Cloud Run redéployé" -ForegroundColor Green
Write-Host ""

Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Attendre 2-3 minutes pour que:" -ForegroundColor White
Write-Host "   - Le DNS privé se propage (TTL: 300 secondes)" -ForegroundColor Gray
Write-Host "   - Cloud Run redémarre complètement" -ForegroundColor Gray
Write-Host "2. Vérifier les logs pour confirmer la connexion Redis:" -ForegroundColor White
Write-Host "   gcloud logging read ""resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE"" --limit=30 --project=$PROJECT --freshness=5m" -ForegroundColor Cyan
Write-Host "3. Tester l'application" -ForegroundColor White
Write-Host ""

Write-Host "Vérifications attendues dans les logs:" -ForegroundColor Yellow
Write-Host "  ✅ Plus d'erreurs 'failed to lookup address information'" -ForegroundColor Green
Write-Host "  ✅ Connexion Redis établie avec succès" -ForegroundColor Green
Write-Host "  ✅ Services Redis démarrant correctement" -ForegroundColor Green
Write-Host ""

Write-Host "Note: Le DNS privé peut prendre quelques minutes pour se propager." -ForegroundColor Gray
Write-Host "Si les erreurs persistent après 5 minutes, vérifier:" -ForegroundColor Gray
Write-Host "  - Que le VPC Connector est READY" -ForegroundColor Gray
Write-Host "  - Que Cloud Run utilise le VPC Connector" -ForegroundColor Gray
Write-Host "  - Que le réseau 'default' est correctement configuré" -ForegroundColor Gray
Write-Host ""

