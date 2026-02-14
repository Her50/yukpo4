# Script de Verification Complete du Nouveau Compte AWS
# Date: 2026-02-14
# Objectif: Verifier tous les elements du nouveau compte AWS avant mise a jour

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpo",
    [string]$Environment = "production"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION COMPLETE COMPTE AWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Projet: $ProjectName" -ForegroundColor Yellow
Write-Host "Environnement: $Environment" -ForegroundColor Yellow
Write-Host ""

$SSM_PREFIX = "/$ProjectName/$Environment"
$S3_BUCKET = "yukpo-backend-media"
$S3_REGION = "eu-west-1"
$CLUSTER_NAME = "yukpo-cluster"
$SERVICE_NAME = "yukpo-backend-service"
$BACKEND_URL = "https://api.yukpomnang.com"

$results = @{
    S3_Bucket = $null
    SSM_Variables = @{}
    CloudFront = $null
    BackendURL = $null
    ECS_Service = $null
    LoadBalancer = $null
}

# ============================================
# 1. VERIFIER LE BUCKET S3
# ============================================
Write-Host "[1/6] Verification du Bucket S3..." -ForegroundColor Yellow
try {
    $bucketCheck = aws s3 ls "s3://$S3_BUCKET" --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Bucket S3 '$S3_BUCKET' existe" -ForegroundColor Green
        $results.S3_Bucket = @{ Exists = $true; Name = $S3_BUCKET }
        
        # Verifier le contenu
        $bucketContent = aws s3 ls "s3://$S3_BUCKET" --region $Region --recursive --summarize 2>&1
        if ($LASTEXITCODE -eq 0) {
            $fileCount = ($bucketContent | Select-String "Total Objects:").ToString().Split(":")[1].Trim()
            Write-Host "  [INFO] Nombre de fichiers: $fileCount" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [MANQUANT] Bucket S3 '$S3_BUCKET' n'existe pas" -ForegroundColor Red
        $results.S3_Bucket = @{ Exists = $false; Name = $S3_BUCKET }
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification: $_" -ForegroundColor Red
    $results.S3_Bucket = @{ Exists = $false; Error = $_.ToString() }
}
Write-Host ""

# ============================================
# 2. VERIFIER LES VARIABLES SSM
# ============================================
Write-Host "[2/6] Verification des Variables SSM..." -ForegroundColor Yellow
$variablesToCheck = @("S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY", "S3_SECRET_KEY", "UPLOAD_BASE_URL")

foreach ($var in $variablesToCheck) {
    $paramName = "$SSM_PREFIX/$var"
    try {
        $result = aws ssm get-parameter --name $paramName --region $Region --query 'Parameter.Value' --output text 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] $var = $result" -ForegroundColor Green
            $results.SSM_Variables[$var] = @{ Exists = $true; Value = $result }
        } else {
            Write-Host "  [MANQUANT] $var n'existe pas" -ForegroundColor Yellow
            $results.SSM_Variables[$var] = @{ Exists = $false }
        }
    } catch {
        Write-Host "  [ERREUR] ${var}: $_" -ForegroundColor Red
        $results.SSM_Variables[$var] = @{ Exists = $false; Error = $_.ToString() }
    }
}
Write-Host ""

# ============================================
# 3. VERIFIER CLOUDFRONT
# ============================================
Write-Host "[3/6] Verification des Distributions CloudFront..." -ForegroundColor Yellow
try {
    $distributions = aws cloudfront list-distributions --region $Region --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' --output json 2>&1 | ConvertFrom-Json
    if ($distributions -and $distributions.Count -gt 0) {
        Write-Host "  [OK] $($distributions.Count) distribution(s) CloudFront trouvee(s)" -ForegroundColor Green
        $cloudFrontList = @()
        foreach ($dist in $distributions) {
            $distId = $dist[0]
            $domainName = $dist[1]
            $originDomain = $dist[2]
            $status = $dist[3]
            Write-Host "    - ID: $distId" -ForegroundColor Gray
            Write-Host "      Domain: $domainName" -ForegroundColor Gray
            Write-Host "      Origin: $originDomain" -ForegroundColor Gray
            Write-Host "      Status: $status" -ForegroundColor Gray
            
            $pointsToCorrectBucket = $originDomain -like "*$S3_BUCKET*"
            if ($pointsToCorrectBucket) {
                Write-Host "      [OK] Pointe vers le bon bucket S3" -ForegroundColor Green
            } else {
                Write-Host "      [ATTENTION] Ne pointe pas vers $S3_BUCKET" -ForegroundColor Yellow
            }
            
            $cloudFrontList += @{
                Id = $distId
                Domain = $domainName
                Origin = $originDomain
                Status = $status
                PointsToCorrectBucket = $pointsToCorrectBucket
            }
        }
        $results.CloudFront = $cloudFrontList
    } else {
        Write-Host "  [INFO] Aucune distribution CloudFront trouvee" -ForegroundColor Yellow
        $results.CloudFront = @()
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification CloudFront: $_" -ForegroundColor Red
    $results.CloudFront = @{ Error = $_.ToString() }
}
Write-Host ""

# ============================================
# 4. VERIFIER L'URL DU BACKEND
# ============================================
Write-Host "[4/6] Verification de l'URL du Backend..." -ForegroundColor Yellow
Write-Host "  Test de connectivite vers $BACKEND_URL..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/health" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] Backend accessible via $BACKEND_URL" -ForegroundColor Green
        Write-Host "  [OK] Code HTTP: $($response.StatusCode)" -ForegroundColor Green
        $results.BackendURL = @{ Accessible = $true; StatusCode = $response.StatusCode; URL = $BACKEND_URL }
    } else {
        Write-Host "  [ATTENTION] Backend repond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
        $results.BackendURL = @{ Accessible = $true; StatusCode = $response.StatusCode; URL = $BACKEND_URL }
    }
} catch {
    Write-Host "  [ERREUR] Impossible de se connecter a $BACKEND_URL" -ForegroundColor Red
    Write-Host "  [INFO] Erreur: $($_.Exception.Message)" -ForegroundColor Gray
    $results.BackendURL = @{ Accessible = $false; Error = $_.Exception.Message; URL = $BACKEND_URL }
}

# Verifier le DNS
Write-Host "  Verification DNS..." -ForegroundColor Cyan
try {
    $dnsResult = Resolve-DnsName -Name "api.yukpomnang.com" -ErrorAction SilentlyContinue
    if ($dnsResult) {
        $ipAddress = $dnsResult[0].IPAddress
        Write-Host "  [OK] DNS resolu: api.yukpomnang.com -> $ipAddress" -ForegroundColor Green
        if ($results.BackendURL) {
            $results.BackendURL.DNS = $ipAddress
        }
    } else {
        Write-Host "  [ATTENTION] Impossible de resoudre le DNS" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la resolution DNS: $_" -ForegroundColor Red
}
Write-Host ""

# ============================================
# 5. VERIFIER LE SERVICE ECS
# ============================================
Write-Host "[5/6] Verification du Service ECS..." -ForegroundColor Yellow
try {
    $serviceInfo = aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $Region --query 'services[0]' --output json 2>&1 | ConvertFrom-Json
    if ($serviceInfo -and $serviceInfo.serviceName) {
        Write-Host "  [OK] Service ECS trouve: $($serviceInfo.serviceName)" -ForegroundColor Green
        Write-Host "  [INFO] Status: $($serviceInfo.status)" -ForegroundColor Gray
        Write-Host "  [INFO] Running Count: $($serviceInfo.runningCount) / Desired: $($serviceInfo.desiredCount)" -ForegroundColor Gray
        
        $results.ECS_Service = @{
            Exists = $true
            Name = $serviceInfo.serviceName
            Status = $serviceInfo.status
            RunningCount = $serviceInfo.runningCount
            DesiredCount = $serviceInfo.desiredCount
        }
        
        # Verifier les deployments
        if ($serviceInfo.deployments) {
            $primaryDeployment = $serviceInfo.deployments | Where-Object { $_.status -eq "PRIMARY" } | Select-Object -First 1
            if ($primaryDeployment) {
                Write-Host "  [INFO] Deployment PRIMARY: $($primaryDeployment.status)" -ForegroundColor Gray
                $results.ECS_Service.PrimaryDeployment = $primaryDeployment.status
            }
        }
    } else {
        Write-Host "  [MANQUANT] Service ECS '$SERVICE_NAME' non trouve" -ForegroundColor Red
        $results.ECS_Service = @{ Exists = $false }
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification ECS: $_" -ForegroundColor Red
    $results.ECS_Service = @{ Exists = $false; Error = $_.ToString() }
}
Write-Host ""

# ============================================
# 6. VERIFIER LE LOAD BALANCER
# ============================================
Write-Host "[6/6] Verification du Load Balancer..." -ForegroundColor Yellow
try {
    $loadBalancers = aws elbv2 describe-load-balancers --region $Region --query 'LoadBalancers[*].[LoadBalancerName,DNSName,State.Code,Type]' --output json 2>&1 | ConvertFrom-Json
    if ($loadBalancers -and $loadBalancers.Count -gt 0) {
        Write-Host "  [OK] $($loadBalancers.Count) Load Balancer(s) trouve(s)" -ForegroundColor Green
        $lbList = @()
        foreach ($lb in $loadBalancers) {
            $lbName = $lb[0]
            $lbDNS = $lb[1]
            $lbState = $lb[2]
            $lbType = $lb[3]
            Write-Host "    - Nom: $lbName" -ForegroundColor Gray
            Write-Host "      DNS: $lbDNS" -ForegroundColor Gray
            Write-Host "      Etat: $lbState" -ForegroundColor Gray
            Write-Host "      Type: $lbType" -ForegroundColor Gray
            
            # Verifier si le LB est associe au service ECS
            $targetGroups = aws elbv2 describe-target-groups --region $Region --load-balancer-arn (aws elbv2 describe-load-balancers --region $Region --query "LoadBalancers[?LoadBalancerName=='$lbName'].LoadBalancerArn" --output text) --query 'TargetGroups[*].TargetGroupName' --output json 2>&1 | ConvertFrom-Json
            if ($targetGroups) {
                Write-Host "      Target Groups: $($targetGroups -join ', ')" -ForegroundColor Gray
            }
            
            $lbList += @{
                Name = $lbName
                DNS = $lbDNS
                State = $lbState
                Type = $lbType
            }
        }
        $results.LoadBalancer = $lbList
    } else {
        Write-Host "  [INFO] Aucun Load Balancer trouve" -ForegroundColor Yellow
        $results.LoadBalancer = @()
    }
} catch {
    Write-Host "  [ERREUR] Erreur lors de la verification Load Balancer: $_" -ForegroundColor Red
    $results.LoadBalancer = @{ Error = $_.ToString() }
}
Write-Host ""

# ============================================
# RAPPORT FINAL
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RAPPORT DE VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Resume S3
Write-Host "BUCKET S3:" -ForegroundColor Yellow
if ($results.S3_Bucket.Exists) {
    Write-Host "  [OK] Bucket existe: $($results.S3_Bucket.Name)" -ForegroundColor Green
} else {
    Write-Host "  [ACTION REQUISE] Creer le bucket: $S3_BUCKET" -ForegroundColor Red
}

# Resume SSM
Write-Host ""
Write-Host "VARIABLES SSM:" -ForegroundColor Yellow
$ssmToUpdate = @()
foreach ($var in $variablesToCheck) {
    if (-not $results.SSM_Variables[$var].Exists) {
        $ssmToUpdate += $var
        Write-Host "  [ACTION REQUISE] Creer/Mettre a jour: $var" -ForegroundColor Red
    } else {
        Write-Host "  [OK] $var existe" -ForegroundColor Green
    }
}

# Resume CloudFront
Write-Host ""
Write-Host "CLOUDFRONT:" -ForegroundColor Yellow
if ($results.CloudFront -and $results.CloudFront.Count -gt 0) {
    $correctDistributions = $results.CloudFront | Where-Object { $_.PointsToCorrectBucket -eq $true }
    if ($correctDistributions) {
        Write-Host "  [OK] Distribution(s) pointe(nt) vers le bon bucket" -ForegroundColor Green
    } else {
        Write-Host "  [ATTENTION] Aucune distribution ne pointe vers $S3_BUCKET" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [INFO] Aucune distribution CloudFront" -ForegroundColor Gray
}

# Resume Backend URL
Write-Host ""
Write-Host "URL BACKEND:" -ForegroundColor Yellow
if ($results.BackendURL.Accessible) {
    Write-Host "  [OK] Backend accessible: $BACKEND_URL" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] Backend non accessible: $BACKEND_URL" -ForegroundColor Red
    Write-Host "  [ACTION REQUISE] Verifier le DNS et la configuration" -ForegroundColor Red
}

# Resume ECS
Write-Host ""
Write-Host "SERVICE ECS:" -ForegroundColor Yellow
if ($results.ECS_Service.Exists) {
    Write-Host "  [OK] Service existe: $($results.ECS_Service.Name)" -ForegroundColor Green
    Write-Host "  [INFO] Status: $($results.ECS_Service.Status)" -ForegroundColor Gray
    Write-Host "  [INFO] Taches: $($results.ECS_Service.RunningCount)/$($results.ECS_Service.DesiredCount)" -ForegroundColor Gray
} else {
    Write-Host "  [ERREUR] Service ECS non trouve" -ForegroundColor Red
}

# Resume Load Balancer
Write-Host ""
Write-Host "LOAD BALANCER:" -ForegroundColor Yellow
if ($results.LoadBalancer -and $results.LoadBalancer.Count -gt 0) {
    Write-Host "  [OK] Load Balancer(s) trouve(s): $($results.LoadBalancer.Count)" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Aucun Load Balancer configure" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ACTIONS REQUISES:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$actionsRequired = $false

if (-not $results.S3_Bucket.Exists) {
    Write-Host "1. [REQUIS] Creer le bucket S3: $S3_BUCKET" -ForegroundColor Red
    $actionsRequired = $true
}

if ($ssmToUpdate.Count -gt 0) {
    Write-Host "2. [REQUIS] Mettre a jour les variables SSM:" -ForegroundColor Red
    foreach ($var in $ssmToUpdate) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    $actionsRequired = $true
}

if (-not $results.BackendURL.Accessible) {
    Write-Host "3. [REQUIS] Verifier/Corriger la configuration DNS pour api.yukpomnang.com" -ForegroundColor Red
    $actionsRequired = $true
}

if (-not $actionsRequired) {
    Write-Host "[OK] Aucune action requise - Tout est configure correctement!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Verification terminee!" -ForegroundColor Cyan

# Sauvegarder les resultats dans un fichier JSON
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath "verification-aws-results.json" -Encoding UTF8
Write-Host ""
Write-Host "Resultats sauvegardes dans: verification-aws-results.json" -ForegroundColor Gray
