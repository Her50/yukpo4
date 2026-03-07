# ============================================================
# Déploiement LiveKit + SRS sur GCP Compute Engine
# Remplace la VM Hetzner par une infrastructure 100% GCP
# ============================================================
param(
    [string]$ProjectId = "yukpo-project",
    [string]$Zone = "europe-west1-b",
    [string]$InstanceName = "yukpo-livekit-server",
    [string]$MachineType = "e2-standard-2",
    [string]$Region = "europe-west1",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Déploiement LiveKit + SRS sur GCP" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] gcloud CLI non installe" -ForegroundColor Red
    exit 1
}

gcloud config set project $ProjectId | Out-Null
Write-Host "[OK] Projet GCP: $ProjectId" -ForegroundColor Green

# 2. Réserver une IP externe statique pour LiveKit
Write-Host ""
Write-Host "[ETAPE 1/6] Reserve IP statique..." -ForegroundColor Yellow

$existingIp = gcloud compute addresses describe yukpo-livekit-ip --region=$Region --format="value(address)" --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creation IP statique yukpo-livekit-ip..." -ForegroundColor Cyan
    if (-not $DryRun) {
        gcloud compute addresses create yukpo-livekit-ip `
            --region=$Region `
            --project=$ProjectId
    }
    $existingIp = gcloud compute addresses describe yukpo-livekit-ip --region=$Region --format="value(address)" --project=$ProjectId 2>&1
}
Write-Host "  [OK] IP LiveKit: $existingIp" -ForegroundColor Green

# 3. Créer les règles de firewall pour LiveKit
Write-Host ""
Write-Host "[ETAPE 2/6] Configuration firewall..." -ForegroundColor Yellow

# API LiveKit + WebSocket (TCP 7880)
$fwLivekit = gcloud compute firewall-rules describe allow-livekit-api --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creation regle firewall: allow-livekit-api (TCP 7880, 7881)" -ForegroundColor Cyan
    if (-not $DryRun) {
        gcloud compute firewall-rules create allow-livekit-api `
            --allow=tcp:7880,tcp:7881 `
            --target-tags=livekit-server `
            --source-ranges=0.0.0.0/0 `
            --description="LiveKit API and TCP fallback" `
            --project=$ProjectId
    }
}
Write-Host "  [OK] Firewall: TCP 7880, 7881" -ForegroundColor Green

# Média WebRTC LiveKit (UDP 50000-60000)
$fwWebrtc = gcloud compute firewall-rules describe allow-livekit-webrtc --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creation regle firewall: allow-livekit-webrtc (UDP 50000-60000)" -ForegroundColor Cyan
    if (-not $DryRun) {
        gcloud compute firewall-rules create allow-livekit-webrtc `
            --allow=udp:50000-60000 `
            --target-tags=livekit-server `
            --source-ranges=0.0.0.0/0 `
            --description="LiveKit WebRTC media UDP ports" `
            --project=$ProjectId
    }
}
Write-Host "  [OK] Firewall: UDP 50000-60000" -ForegroundColor Green

# SRS RTMP + HLS (TCP 1935, 8080)
$fwSrs = gcloud compute firewall-rules describe allow-srs-streaming --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creation regle firewall: allow-srs-streaming (TCP 1935, 8080)" -ForegroundColor Cyan
    if (-not $DryRun) {
        gcloud compute firewall-rules create allow-srs-streaming `
            --allow=tcp:1935,tcp:8080 `
            --target-tags=livekit-server `
            --source-ranges=0.0.0.0/0 `
            --description="SRS RTMP and HLS streaming" `
            --project=$ProjectId
    }
}
Write-Host "  [OK] Firewall: TCP 1935, 8080" -ForegroundColor Green

# 4. Créer l'instance GCE
Write-Host ""
Write-Host "[ETAPE 3/6] Creation instance GCE..." -ForegroundColor Yellow

$existingInstance = gcloud compute instances describe $InstanceName --zone=$Zone --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Instance $InstanceName existe deja" -ForegroundColor Yellow
    Write-Host "  Suppression et recreation..." -ForegroundColor Yellow
    if (-not $DryRun) {
        gcloud compute instances delete $InstanceName --zone=$Zone --project=$ProjectId --quiet
    }
}

$startupScript = Get-Content -Path "$PSScriptRoot\livekit-gce-startup.sh" -Raw

Write-Host "  Creation $InstanceName ($MachineType) dans $Zone..." -ForegroundColor Cyan
if (-not $DryRun) {
    gcloud compute instances create $InstanceName `
        --zone=$Zone `
        --machine-type=$MachineType `
        --image-family=debian-12 `
        --image-project=debian-cloud `
        --boot-disk-size=30GB `
        --boot-disk-type=pd-balanced `
        --tags=livekit-server `
        --address=yukpo-livekit-ip `
        --scopes=cloud-platform `
        --metadata-from-file=startup-script="$PSScriptRoot\livekit-gce-startup.sh" `
        --project=$ProjectId
}
Write-Host "  [OK] Instance creee" -ForegroundColor Green

# 5. Attendre que l'instance soit prête
Write-Host ""
Write-Host "[ETAPE 4/6] Attente demarrage..." -ForegroundColor Yellow

if (-not $DryRun) {
    Start-Sleep -Seconds 30
    
    # Récupérer l'IP externe
    $instanceIp = gcloud compute instances describe $InstanceName `
        --zone=$Zone `
        --project=$ProjectId `
        --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
    
    Write-Host "  IP externe: $instanceIp" -ForegroundColor Green
    
    # Attendre que LiveKit soit opérationnel (max 3 minutes)
    Write-Host "  Attente LiveKit (max 3 min)..." -ForegroundColor Cyan
    $ready = $false
    for ($i = 1; $i -le 18; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://${instanceIp}:7880" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {}
        Write-Host "  Attente... ($i/18)" -ForegroundColor Gray
        Start-Sleep -Seconds 10
    }
    
    if ($ready) {
        Write-Host "  [OK] LiveKit est operationnel!" -ForegroundColor Green
    } else {
        Write-Host "  [ATTENTION] LiveKit pas encore pret - verifier les logs" -ForegroundColor Yellow
        Write-Host "  Logs: gcloud compute ssh $InstanceName --zone=$Zone -- 'sudo cat /var/log/yukpo-livekit.log'" -ForegroundColor Gray
    }
} else {
    $instanceIp = $existingIp
}

# 6. Mettre à jour le backend Cloud Run avec les nouveaux endpoints GCP
Write-Host ""
Write-Host "[ETAPE 5/6] Mise a jour Cloud Run backend..." -ForegroundColor Yellow

$newEnvVars = @(
    "LIVEKIT_API_URL=http://${instanceIp}:7880",
    "LIVEKIT_WS_URL=ws://${instanceIp}:7880",
    "LIVEKIT_HLS_URL=http://${instanceIp}:8080/live",
    "LIVEKIT_INGRESS_MODE=rtmp",
    "LIVEKIT_INGRESS_REGION=europe-west1",
    "LIVEKIT_INGRESS_ROOM=live-events",
    "LIVE_FALLBACK_ENABLED=true",
    "LIVE_RECORDING_ENABLED=true",
    "FEATURE_FLAG_CONNECTORS_LIVEKIT=true",
    "SRS_HLS_URL=http://${instanceIp}:8080/live",
    "SRS_RTMP_URL=rtmp://${instanceIp}:1935/live"
    # NOTE: VIDEO_RENDERER_RPC_URL n'est PAS ici car le renderer tourne sur le GPU worker GCP (34.140.79.59:8080)
)

$envVarsStr = $newEnvVars -join ","

Write-Host "  Variables:" -ForegroundColor Cyan
foreach ($v in $newEnvVars) {
    $name = $v.Split("=")[0]
    Write-Host "    $name" -ForegroundColor Gray
}

if (-not $DryRun) {
    gcloud run services update yukpo-backend `
        --region=$Region `
        --project=$ProjectId `
        --update-env-vars="$envVarsStr"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Cloud Run mis a jour" -ForegroundColor Green
    } else {
        Write-Host "  [ERREUR] Echec mise a jour Cloud Run" -ForegroundColor Red
    }
}

# 7. Résumé
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " RESUME DEPLOIEMENT GCP" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Instance:     $InstanceName" -ForegroundColor White
Write-Host "  Zone:         $Zone" -ForegroundColor White
Write-Host "  Machine:      $MachineType" -ForegroundColor White
Write-Host "  IP:           $instanceIp" -ForegroundColor Green
Write-Host ""
Write-Host "  Endpoints GCP:" -ForegroundColor Cyan
Write-Host "    LiveKit API:  http://${instanceIp}:7880" -ForegroundColor Green
Write-Host "    LiveKit WS:   ws://${instanceIp}:7880" -ForegroundColor Green
Write-Host "    SRS RTMP:     rtmp://${instanceIp}:1935/live" -ForegroundColor Green
Write-Host "    SRS HLS:      http://${instanceIp}:8080/live" -ForegroundColor Green
Write-Host ""
Write-Host "  WebRTC Signaling: via Cloud Run (yukpo-backend)" -ForegroundColor Green
Write-Host "    Endpoint: wss://yukpo-backend-376093909298.europe-west1.run.app/ws/webrtc" -ForegroundColor Green
Write-Host ""
Write-Host "  Hetzner: PLUS UTILISE" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Verification:" -ForegroundColor Cyan
Write-Host "    curl http://${instanceIp}:7880" -ForegroundColor Gray
Write-Host "    curl http://${instanceIp}:8080/api/v1/versions" -ForegroundColor Gray
Write-Host "    gcloud compute ssh $InstanceName --zone=$Zone -- 'docker ps'" -ForegroundColor Gray
Write-Host ""
