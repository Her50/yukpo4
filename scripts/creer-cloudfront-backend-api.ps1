# Script pour créer une distribution CloudFront pour le backend API
# Date: 2026-02-14
# Objectif: Créer CloudFront avec l'IP directe du backend en attendant le Load Balancer

param(
    [string]$Region = "eu-west-1",
    [string]$BackendIP = "52.211.202.11",
    [int]$BackendPort = 8080
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREATION CLOUDFRONT POUR BACKEND API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtenir le répertoire du script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Chemin vers le fichier de configuration
$ConfigFile = Join-Path $ProjectRoot "cloudfront-config-backend-api.json"

Write-Host "[1/4] Verification de l'IP publique ECS..." -ForegroundColor Yellow
try {
    $taskArn = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region $Region --desired-status RUNNING --query 'taskArns[0]' --output text
    
    if ($taskArn) {
        $taskDetails = aws ecs describe-tasks --cluster yukpo-cluster --tasks $taskArn --region $Region --query 'tasks[0]' --output json | ConvertFrom-Json
        $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
        
        if ($eniId) {
            $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region $Region --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
            
            if ($eniDetails.Association.PublicIp) {
                $BackendIP = $eniDetails.Association.PublicIp
                Write-Host "  [OK] IP publique actuelle: $BackendIP" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "  [ATTENTION] Utilisation de l'IP par defaut: $BackendIP" -ForegroundColor Yellow
    Write-Host "  [INFO] Note: Cette IP peut changer a chaque redemarrage ECS" -ForegroundColor Gray
}
Write-Host ""

# Mettre à jour le fichier de configuration avec l'IP actuelle
Write-Host "[2/4] Mise a jour de la configuration CloudFront..." -ForegroundColor Yellow
try {
    $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    $config.Origins.Items[0].DomainName = $BackendIP
    $config.Origins.Items[0].CustomOriginConfig.HTTPPort = $BackendPort
    $config.Origins.Items[0].CustomOriginConfig.HTTPSPort = $BackendPort
    $config.CallerReference = "yukpo-backend-api-$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    # Supprimer OriginCustomHeaders s'il existe (paramètre invalide)
    if ($config.Origins.Items[0].PSObject.Properties.Name -contains "OriginCustomHeaders") {
        $config.Origins.Items[0].PSObject.Properties.Remove("OriginCustomHeaders")
    }
    
    # Écrire le JSON sans BOM UTF-8
    $jsonContent = $config | ConvertTo-Json -Depth 10
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($ConfigFile, $jsonContent, $utf8NoBom)
    Write-Host "  [OK] Configuration mise a jour avec IP: ${BackendIP}:${BackendPort}" -ForegroundColor Green
} catch {
    Write-Host "  [ERREUR] Impossible de mettre a jour la configuration: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Vérifier les distributions existantes
Write-Host "[3/4] Verification des distributions existantes..." -ForegroundColor Yellow
try {
    $distributions = aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' --output json 2>&1 | ConvertFrom-Json
    
    if ($distributions -and $distributions.Count -gt 0) {
        Write-Host "  [INFO] $($distributions.Count) distribution(s) trouvee(s):" -ForegroundColor Gray
        foreach ($dist in $distributions) {
            Write-Host "    - ID: $($dist[0]), Domain: $($dist[1]), Origin: $($dist[2]), Status: $($dist[3])" -ForegroundColor Gray
        }
        
        # Vérifier si une distribution pointe déjà vers cette IP
        $existingDist = $distributions | Where-Object { $_[2] -eq $BackendIP }
        if ($existingDist) {
            Write-Host "  [INFO] Distribution existante trouvee pour cette IP:" -ForegroundColor Yellow
            Write-Host "    ID: $($existingDist[0])" -ForegroundColor Gray
            Write-Host "    Domain: $($existingDist[1])" -ForegroundColor Gray
            Write-Host "  [ACTION] Utiliser cette distribution ou en creer une nouvelle?" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [INFO] Aucune distribution trouvee" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [ATTENTION] Impossible de lister les distributions: $_" -ForegroundColor Yellow
}
Write-Host ""

# Créer la distribution CloudFront
Write-Host "[4/4] Creation de la distribution CloudFront..." -ForegroundColor Yellow
Write-Host "  [INFO] Fichier de configuration: $ConfigFile" -ForegroundColor Gray
Write-Host "  [INFO] Origin: ${BackendIP}:${BackendPort}" -ForegroundColor Gray
Write-Host ""

# Vérifier que le fichier existe
if (-not (Test-Path $ConfigFile)) {
    Write-Host "  [ERREUR] Fichier de configuration non trouve: $ConfigFile" -ForegroundColor Red
    exit 1
}

# Créer la distribution
Write-Host "  [INFO] Envoi de la requete de creation..." -ForegroundColor Gray
$createResult = aws cloudfront create-distribution --distribution-config file://$ConfigFile --output json 2>&1

if ($LASTEXITCODE -eq 0) {
    $distData = $createResult | ConvertFrom-Json
    $distId = $distData.Distribution.Id
    $distDomain = $distData.Distribution.DomainName
    
    Write-Host "  [OK] Distribution creee avec succes!" -ForegroundColor Green
    Write-Host "    ID: $distId" -ForegroundColor Gray
    Write-Host "    Domain: $distDomain" -ForegroundColor Gray
    Write-Host "    [INFO] Deploiement en cours (5-15 minutes)..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [ACTION] Apres deploiement, mettre a jour:" -ForegroundColor Cyan
    Write-Host "    - DNS: api.yukpomnang.com -> CNAME vers $distDomain" -ForegroundColor White
    Write-Host "    - production (2).json -> EXPO_PUBLIC_CDN_CLOUDFLARE_URL = https://$distDomain" -ForegroundColor White
} else {
    Write-Host "  [ERREUR] Echec de la creation:" -ForegroundColor Red
    Write-Host $createResult -ForegroundColor Red
    Write-Host ""
    Write-Host "  [INFO] Solutions alternatives:" -ForegroundColor Yellow
    Write-Host "    1. Creer manuellement via AWS Console:" -ForegroundColor White
    Write-Host "       https://console.aws.amazon.com/cloudfront/" -ForegroundColor Gray
    Write-Host "    2. Verifier les permissions IAM" -ForegroundColor White
    Write-Host "    3. Utiliser le script configurer-tout-automatiquement.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

