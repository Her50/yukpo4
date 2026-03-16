# =============================================================================
# Script PowerShell: Configuration domaine custom pour Cloud Run
# Usage: .\scripts\setup-custom-domain.ps1 [-Domain <domain>]
# =============================================================================

param(
    [string]$Domain = "yukpo.com",
    [string]$ApiSubdomain = "api",
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPO - Configuration Domaine Custom Cloud Run" -ForegroundColor Cyan
Write-Host "  Domaine: $Domain | API: $ApiSubdomain.$Domain" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# Pre-requis
# =============================================================================
Write-Host "--- Pre-requis ---" -ForegroundColor Yellow
Write-Host "1. Domaine $Domain achete et accessible (registrar: Namecheap, GoDaddy, etc.)" -ForegroundColor White
Write-Host "2. Acces au panneau DNS du registrar" -ForegroundColor White
Write-Host "3. gcloud CLI installe et authentifie" -ForegroundColor White
Write-Host ""

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] gcloud CLI non installe" -ForegroundColor Red
    exit 1
}

# =============================================================================
# Etape 1: Verifier le domaine dans GCP
# =============================================================================
Write-Host "--- Etape 1: Verification du domaine ---" -ForegroundColor Yellow
Write-Host ""
Write-Host "Verifiez que le domaine est verifie dans Google Search Console:" -ForegroundColor White
Write-Host "  https://search.google.com/search-console" -ForegroundColor Gray
Write-Host ""
Write-Host "Ou verifiez via gcloud:" -ForegroundColor White
Write-Host "  gcloud domains verify $Domain" -ForegroundColor Gray
Write-Host ""

$continue = Read-Host "Le domaine $Domain est-il verifie? (o/N)"
if ($continue -ne "o" -and $continue -ne "O") {
    Write-Host ""
    Write-Host "Pour verifier le domaine:" -ForegroundColor Yellow
    Write-Host "1. Allez sur https://search.google.com/search-console" -ForegroundColor White
    Write-Host "2. Ajoutez la propriete $Domain" -ForegroundColor White
    Write-Host "3. Suivez les instructions de verification DNS (ajout TXT record)" -ForegroundColor White
    Write-Host ""
    Write-Host "Record DNS a ajouter chez votre registrar:" -ForegroundColor Cyan
    Write-Host "  Type: TXT" -ForegroundColor White
    Write-Host "  Host: @" -ForegroundColor White
    Write-Host "  Value: (fourni par Google Search Console)" -ForegroundColor White
    Write-Host ""
    exit 0
}

# =============================================================================
# Etape 2: Mapper le domaine sur Cloud Run
# =============================================================================
Write-Host ""
Write-Host "--- Etape 2: Mapping domaine -> Cloud Run ---" -ForegroundColor Yellow
Write-Host ""

Write-Host "Option A: Mapper api.$Domain (recommande pour le backend):" -ForegroundColor Cyan
Write-Host "  gcloud beta run domain-mappings create \" -ForegroundColor Gray
Write-Host "    --service=$ServiceName \" -ForegroundColor Gray
Write-Host "    --domain=$ApiSubdomain.$Domain \" -ForegroundColor Gray
Write-Host "    --region=$Region \" -ForegroundColor Gray
Write-Host "    --project=$ProjectId" -ForegroundColor Gray
Write-Host ""

$mapDomain = Read-Host "Creer le mapping $ApiSubdomain.$Domain -> $ServiceName? (o/N)"
if ($mapDomain -eq "o" -or $mapDomain -eq "O") {
    Write-Host "Creation du mapping..." -ForegroundColor Cyan
    gcloud beta run domain-mappings create `
        --service=$ServiceName `
        --domain="$ApiSubdomain.$Domain" `
        --region=$Region `
        --project=$ProjectId

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Mapping cree" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Echec du mapping" -ForegroundColor Red
        Write-Host "  Si erreur 'domain not verified', verifiez l'etape 1" -ForegroundColor Yellow
    }
}

# =============================================================================
# Etape 3: Configuration DNS
# =============================================================================
Write-Host ""
Write-Host "--- Etape 3: Configuration DNS chez votre registrar ---" -ForegroundColor Yellow
Write-Host ""

Write-Host "Recuperation des records DNS requis..." -ForegroundColor Cyan
$mappingInfo = gcloud beta run domain-mappings describe `
    --domain="$ApiSubdomain.$Domain" `
    --region=$Region `
    --project=$ProjectId `
    --format=json 2>&1

if ($LASTEXITCODE -eq 0) {
    $mapping = $mappingInfo | ConvertFrom-Json
    $records = $mapping.status.resourceRecords
    Write-Host ""
    Write-Host "Ajoutez ces records DNS chez votre registrar:" -ForegroundColor Cyan
    Write-Host ""
    foreach ($r in $records) {
        Write-Host "  Type: $($r.type)" -ForegroundColor White
        Write-Host "  Host: $($r.name)" -ForegroundColor White
        Write-Host "  Value: $($r.rrdata)" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "Records DNS typiques pour Cloud Run:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Pour $ApiSubdomain.$Domain :" -ForegroundColor White
    Write-Host "    Type: CNAME" -ForegroundColor White
    Write-Host "    Host: $ApiSubdomain" -ForegroundColor White
    Write-Host "    Value: ghs.googlehosted.com." -ForegroundColor White
    Write-Host ""
    Write-Host "  Pour $Domain (si frontend):" -ForegroundColor White
    Write-Host "    Type: A" -ForegroundColor White
    Write-Host "    Host: @" -ForegroundColor White
    Write-Host "    Value: (voir console GCP)" -ForegroundColor White
    Write-Host ""
}

# =============================================================================
# Etape 4: SSL/TLS (automatique)
# =============================================================================
Write-Host ""
Write-Host "--- Etape 4: SSL/TLS ---" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cloud Run fournit automatiquement un certificat SSL/TLS Let's Encrypt." -ForegroundColor White
Write-Host "Le provisionnement peut prendre 15-30 minutes apres configuration DNS." -ForegroundColor White
Write-Host ""
Write-Host "Verifier le statut SSL:" -ForegroundColor Cyan
Write-Host "  gcloud beta run domain-mappings describe \" -ForegroundColor Gray
Write-Host "    --domain=$ApiSubdomain.$Domain \" -ForegroundColor Gray
Write-Host "    --region=$Region --project=$ProjectId \" -ForegroundColor Gray
Write-Host "    --format='value(status.conditions)'" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Etape 5: Mise a jour des env vars apres custom domain
# =============================================================================
Write-Host ""
Write-Host "--- Etape 5: Mise a jour env vars (apres domaine actif) ---" -ForegroundColor Yellow
Write-Host ""
Write-Host "Une fois le domaine actif, mettez a jour ces variables:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  gcloud run services update $ServiceName --region=$Region \" -ForegroundColor Gray
Write-Host "    --update-env-vars=`"" -NoNewline -ForegroundColor Gray
Write-Host "BACKEND_URL=https://$ApiSubdomain.$Domain," -NoNewline -ForegroundColor White
Write-Host "WEBHOOK_BASE_URL=https://$ApiSubdomain.$Domain," -NoNewline -ForegroundColor White
Write-Host "API_BASE_URL=https://$ApiSubdomain.$Domain," -NoNewline -ForegroundColor White
Write-Host "CORS_ALLOWED_ORIGINS=https://$Domain`$(,)https://$ApiSubdomain.$Domain`"" -ForegroundColor White
Write-Host ""
Write-Host "Et dans mobile/eas.json, mettez a jour EXPO_PUBLIC_API_URL:" -ForegroundColor Cyan
Write-Host "  `"EXPO_PUBLIC_API_URL`": `"https://$ApiSubdomain.$Domain`"" -ForegroundColor White
Write-Host ""

# =============================================================================
# Resume
# =============================================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESUME - Etapes domaine custom" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  1. Verifier domaine dans Google Search Console" -ForegroundColor White
Write-Host "  2. gcloud beta run domain-mappings create --domain=$ApiSubdomain.$Domain" -ForegroundColor White
Write-Host "  3. Ajouter CNAME $ApiSubdomain -> ghs.googlehosted.com chez registrar" -ForegroundColor White
Write-Host "  4. Attendre provisionnement SSL (15-30 min)" -ForegroundColor White
Write-Host "  5. Mettre a jour BACKEND_URL, WEBHOOK_BASE_URL, CORS_ALLOWED_ORIGINS" -ForegroundColor White
Write-Host "  6. Mettre a jour EXPO_PUBLIC_API_URL dans mobile/eas.json" -ForegroundColor White
Write-Host ""
