# Script pour configurer automatiquement DNS Cloudflare et CloudFront
# Date: 2026-02-14

param(
    [string]$CloudflareEmail = "",
    [string]$CloudflareAPIKey = "",
    [string]$CloudflareZoneID = "",
    [string]$Subdomain = "api",
    [string]$Domain = "yukpomnang.com"
)

# Obtenir le répertoire du script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Changer vers le répertoire du projet pour les chemins relatifs
Push-Location $ProjectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION AUTOMATIQUE COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. RECUPERER LE DNS DU LOAD BALANCER
# ============================================
Write-Host "[1/4] Recuperation du DNS du Load Balancer..." -ForegroundColor Yellow
try {
    $albOutput = terraform -chdir=infra/aws output -raw alb_dns_name 2>&1
    if ($LASTEXITCODE -eq 0 -and $albOutput -and $albOutput -notlike "*Error*") {
        $albDNS = $albOutput.Trim()
        Write-Host "  [OK] Load Balancer DNS: $albDNS" -ForegroundColor Green
    } else {
        # Essayer via AWS CLI
        $albInfo = aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[?LoadBalancerName==`yukpo-alb`].[DNSName,CanonicalHostedZoneId]' --output json 2>&1 | ConvertFrom-Json
        if ($albInfo -and $albInfo.Count -gt 0) {
            $albDNS = $albInfo[0][0]
            Write-Host "  [OK] Load Balancer DNS: $albDNS" -ForegroundColor Green
        } else {
            Write-Host "  [ATTENTION] Load Balancer non trouve, utilisation de l'IP directe" -ForegroundColor Yellow
            $albDNS = $null
        }
    }
} catch {
    Write-Host "  [ATTENTION] Impossible de recuperer le DNS du Load Balancer" -ForegroundColor Yellow
    Write-Host "  [INFO] Utilisation de l'IP directe temporairement" -ForegroundColor Gray
    $albDNS = $null
}

# Si pas de Load Balancer, utiliser l'IP directe
if (-not $albDNS) {
    Write-Host "[INFO] Recuperation de l'IP publique ECS..." -ForegroundColor Yellow
    try {
        $taskArn = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text
        if ($taskArn) {
            $taskDetails = aws ecs describe-tasks --cluster yukpo-cluster --tasks $taskArn --region eu-west-1 --query 'tasks[0]' --output json | ConvertFrom-Json
            $eniId = $taskDetails.attachments[0].details | Where-Object { $_.name -eq "networkInterfaceId" } | Select-Object -ExpandProperty value
            
            if ($eniId) {
                $eniDetails = aws ec2 describe-network-interfaces --network-interface-ids $eniId --region eu-west-1 --query 'NetworkInterfaces[0]' --output json | ConvertFrom-Json
                if ($eniDetails.Association.PublicIp) {
                    $targetIP = $eniDetails.Association.PublicIp
                    Write-Host "  [OK] IP publique: $targetIP" -ForegroundColor Green
                }
            }
        }
    } catch {
        $targetIP = "52.211.202.11"  # IP par défaut
        Write-Host "  [INFO] Utilisation de l'IP par defaut: $targetIP" -ForegroundColor Gray
    }
} else {
    $targetIP = $null
}
Write-Host ""

# ============================================
# 2. CONFIGURER DNS CLOUDFLARE
# ============================================
Write-Host "[2/4] Configuration DNS Cloudflare..." -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($CloudflareEmail) -and [string]::IsNullOrEmpty($CloudflareAPIKey)) {
    Write-Host "  [ATTENTION] Credentials Cloudflare non fournis" -ForegroundColor Yellow
    Write-Host "  [INFO] Utilisation du script avec credentials:" -ForegroundColor Cyan
    Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\configurer-dns-cloudflare-automatique.ps1 -CloudflareAPIKey <TOKEN> -Subdomain api" -ForegroundColor Gray
    if ($albDNS) {
        Write-Host "  [INFO] Target: $albDNS (CNAME)" -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] Target: $targetIP (A)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  [ACTION MANUELLE] Aller sur https://dash.cloudflare.com" -ForegroundColor Cyan
    Write-Host "    1. Selectionner le domaine $Domain" -ForegroundColor White
    Write-Host "    2. DNS > Enregistrements > Creer/Modifier 'api'" -ForegroundColor White
    if ($albDNS) {
        Write-Host "    3. Type: CNAME, Target: $albDNS, Proxy: OFF" -ForegroundColor White
    } else {
        Write-Host "    3. Type: A, IPv4: $targetIP, Proxy: OFF" -ForegroundColor White
    }
    Write-Host "    4. Sauvegarder" -ForegroundColor White
} else {
    # Utiliser le script automatique
    Write-Host "  [INFO] Utilisation des credentials fournis" -ForegroundColor Gray
    if ($albDNS) {
        Write-Host "  [INFO] Configuration CNAME vers Load Balancer: $albDNS" -ForegroundColor Gray
        # Note: Cloudflare API nécessite une configuration spéciale pour CNAME
        Write-Host "  [ATTENTION] Configuration CNAME via API Cloudflare necessite des permissions speciales" -ForegroundColor Yellow
        Write-Host "  [ACTION] Configurer manuellement dans Cloudflare Dashboard" -ForegroundColor Cyan
    } else {
        Write-Host "  [INFO] Configuration A vers IP: $targetIP" -ForegroundColor Gray
        $scriptPath = Join-Path $PSScriptRoot "configurer-dns-cloudflare-automatique.ps1"
        if (Test-Path $scriptPath) {
            & $scriptPath -CloudflareEmail $CloudflareEmail -CloudflareAPIKey $CloudflareAPIKey -CloudflareZoneID $CloudflareZoneID -Subdomain $Subdomain -TargetIP $targetIP
        }
    }
}
Write-Host ""

# ============================================
# 3. CREER DISTRIBUTION CLOUDFRONT
# ============================================
Write-Host "[3/4] Creation de la distribution CloudFront..." -ForegroundColor Yellow
try {
    # Vérifier si une distribution existe déjà
    $existingDists = aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' --output json 2>&1 | ConvertFrom-Json
    
    $targetDistribution = $null
    if ($existingDists -and $existingDists.Count -gt 0) {
        foreach ($dist in $existingDists) {
            if ($dist[2] -like "*yukpo-backend-media*") {
                $targetDistribution = $dist
                Write-Host "  [OK] Distribution existante trouvee:" -ForegroundColor Green
                Write-Host "    ID: $($dist[0])" -ForegroundColor Gray
                Write-Host "    Domain: $($dist[1])" -ForegroundColor Gray
                Write-Host "    Origin: $($dist[2])" -ForegroundColor Gray
                break
            }
        }
    }
    
    if (-not $targetDistribution) {
        Write-Host "  [INFO] Creation d'une nouvelle distribution..." -ForegroundColor Gray
        
        # Créer un CallerReference unique
        $callerRef = "yukpo-backend-media-$(Get-Date -Format 'yyyyMMddHHmmss')"
        
        # Créer le fichier de configuration
        $cloudfrontConfig = @{
            CallerReference = $callerRef
            Comment = "CloudFront distribution for yukpo-backend-media S3 bucket"
            Origins = @{
                Quantity = 1
                Items = @(
                    @{
                        Id = "S3-yukpo-backend-media"
                        DomainName = "yukpo-backend-media.s3.eu-west-1.amazonaws.com"
                        S3OriginConfig = @{
                            OriginAccessIdentity = ""
                        }
                    }
                )
            }
            DefaultCacheBehavior = @{
                TargetOriginId = "S3-yukpo-backend-media"
                ViewerProtocolPolicy = "redirect-to-https"
                AllowedMethods = @{
                    Quantity = 3
                    Items = @("GET", "HEAD", "OPTIONS")
                    CachedMethods = @{
                        Quantity = 2
                        Items = @("GET", "HEAD")
                    }
                }
                ForwardedValues = @{
                    QueryString = $false
                    Cookies = @{
                        Forward = "none"
                    }
                }
                MinTTL = 0
                DefaultTTL = 86400
                MaxTTL = 31536000
                Compress = $true
            }
            Enabled = $true
            PriceClass = "PriceClass_100"
        } | ConvertTo-Json -Depth 10
        
        $configFile = "cloudfront-config-temp.json"
        $cloudfrontConfig | Out-File -FilePath $configFile -Encoding UTF8 -NoNewline
        
        # Créer la distribution
        Write-Host "  [INFO] Envoi de la requete de creation..." -ForegroundColor Gray
        $createResult = aws cloudfront create-distribution --distribution-config file://$configFile --output json 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $distData = $createResult | ConvertFrom-Json
            $distId = $distData.Distribution.Id
            $distDomain = $distData.Distribution.DomainName
            
            Write-Host "  [OK] Distribution creee avec succes!" -ForegroundColor Green
            Write-Host "    ID: $distId" -ForegroundColor Gray
            Write-Host "    Domain: $distDomain" -ForegroundColor Gray
            Write-Host "    [INFO] Deploiement en cours (5-15 minutes)..." -ForegroundColor Yellow
            
            # Mettre à jour production (2).json
            Write-Host "  [INFO] Mise a jour de production (2).json..." -ForegroundColor Gray
            $prodFile = "production (2).json"
            if (Test-Path $prodFile) {
                $prodContent = Get-Content $prodFile -Raw | ConvertFrom-Json
                $prodContent.EXPO_PUBLIC_CDN_CLOUDFLARE_URL = "https://$distDomain"
                $prodContent | ConvertTo-Json -Depth 10 | Set-Content $prodFile -Encoding UTF8
                Write-Host "    [OK] production (2).json mis a jour avec: https://$distDomain" -ForegroundColor Green
            }
        } else {
            Write-Host "  [ERREUR] Echec de la creation: $createResult" -ForegroundColor Red
            Write-Host "  [INFO] Creer manuellement via AWS Console" -ForegroundColor Yellow
        }
        
        # Nettoyer
        if (Test-Path $configFile) {
            Remove-Item $configFile
        }
    } else {
        Write-Host "  [OK] Distribution deja existante, pas besoin de creer" -ForegroundColor Green
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la creation CloudFront: $_" -ForegroundColor Red
    Write-Host "  [INFO] Creer manuellement via AWS Console" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# 4. VERIFICATION FINALE
# ============================================
Write-Host "[4/4] Verification finale..." -ForegroundColor Yellow
Write-Host "  [INFO] Attendez 2-5 minutes pour la propagation DNS" -ForegroundColor Gray
Write-Host "  [INFO] Testez avec:" -ForegroundColor Cyan
Write-Host "    nslookup ${Subdomain}.${Domain}" -ForegroundColor White
Write-Host "    curl https://${Subdomain}.${Domain}/health" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Restaurer le répertoire
Pop-Location

