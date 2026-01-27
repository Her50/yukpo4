# Script de verification du CDN CloudFront et du Backend AWS
# Usage: .\scripts\verify-aws-cdn-backend-simple.ps1

param(
    [string]$Region = "us-east-1",
    [string]$BackendURL = "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
    [string]$CDNURL = "https://cdn.yukpomnang.com",
    [string]$S3Bucket = "yukpomnang-media-prod",
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service"
)

$ErrorActionPreference = "Continue"
$allChecksPassed = $true

Write-Host ""
Write-Host "Verification du Systeme CDN et Backend AWS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour tester un endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$URL,
        [string]$Method = "GET",
        [int]$TimeoutSeconds = 10
    )
    
    Write-Host "Test: $Name" -ForegroundColor Yellow
    Write-Host "   URL: $URL" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $URL -Method $Method -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        Write-Host "   [OK] Statut: $($response.StatusCode)" -ForegroundColor Green
        return @{ Success = $true; StatusCode = $response.StatusCode }
    }
    catch {
        $statusCode = "N/A"
        if ($_.Exception.Response) {
            try {
                $statusCode = $_.Exception.Response.StatusCode.value__
            }
            catch {
                # StatusCode non disponible
            }
        }
        Write-Host "   [ERREUR] $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message }
    }
}

# Fonction pour verifier AWS CLI
function Test-AWSCLI {
    Write-Host ""
    Write-Host "Verification AWS CLI..." -ForegroundColor Yellow
    
    try {
        $awsVersion = aws --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] AWS CLI installe: $awsVersion" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "   [ERREUR] AWS CLI non disponible" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "   [ERREUR] AWS CLI non installe ou non dans PATH" -ForegroundColor Red
        return $false
    }
}

# ============================================
# 1. VERIFICATION DU BACKEND AWS (ALB)
# ============================================
Write-Host ""
Write-Host "1. VERIFICATION DU BACKEND AWS" -ForegroundColor Cyan
Write-Host "-------------------------------" -ForegroundColor Cyan

# Test Health Check
$healthCheck = Test-Endpoint -Name "Health Check Backend" -URL "$BackendURL/health"
if (-not $healthCheck.Success) {
    $allChecksPassed = $false
}

# Test API Root
$apiRoot = Test-Endpoint -Name "API Root" -URL "$BackendURL/api/v1" -TimeoutSeconds 5

# Verifier le statut ECS via AWS CLI
$awsCLIAvailable = Test-AWSCLI
if ($awsCLIAvailable) {
    Write-Host ""
    Write-Host "Statut du Service ECS..." -ForegroundColor Yellow
    try {
        $serviceInfo = aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $Region --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount,TaskDefinition:taskDefinition}' --output json 2>&1 | ConvertFrom-Json
        
        if ($serviceInfo) {
            Write-Host "   [OK] Service: $ServiceName" -ForegroundColor Green
            Write-Host "   Statut: $($serviceInfo.Status)" -ForegroundColor $(if ($serviceInfo.Status -eq "ACTIVE") { "Green" } else { "Yellow" })
            Write-Host "   Taches: $($serviceInfo.RunningCount)/$($serviceInfo.DesiredCount)" -ForegroundColor $(if ($serviceInfo.RunningCount -eq $serviceInfo.DesiredCount) { "Green" } else { "Yellow" })
            Write-Host "   Task Definition: $($serviceInfo.TaskDefinition.Split('/')[-1])" -ForegroundColor Gray
            
            if ($serviceInfo.RunningCount -lt $serviceInfo.DesiredCount) {
                Write-Host "   [ATTENTION] Nombre de taches inferieur au nombre desire" -ForegroundColor Yellow
                $allChecksPassed = $false
            }
        }
        else {
            Write-Host "   [ATTENTION] Service ECS non trouve ou non accessible" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "   [ATTENTION] Impossible de recuperer les informations ECS: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Verifier les taches en cours
    Write-Host ""
    Write-Host "Taches ECS en cours..." -ForegroundColor Yellow
    try {
        $tasks = aws ecs list-tasks --cluster $ClusterName --service-name $ServiceName --region $Region --desired-status RUNNING --output json 2>&1 | ConvertFrom-Json
        
        if ($tasks.taskArns -and $tasks.taskArns.Count -gt 0) {
            Write-Host "   [OK] $($tasks.taskArns.Count) tache(s) en cours" -ForegroundColor Green
            
            # Obtenir les details de la premiere tache
            $taskArn = $tasks.taskArns[0]
            $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0].{LastStatus:lastStatus,HealthStatus:healthStatus,StartedAt:startedAt}' --output json 2>&1 | ConvertFrom-Json
            
            if ($taskDetails) {
                Write-Host "   Statut: $($taskDetails.LastStatus)" -ForegroundColor $(if ($taskDetails.LastStatus -eq "RUNNING") { "Green" } else { "Yellow" })
                Write-Host "   Sante: $($taskDetails.HealthStatus)" -ForegroundColor $(if ($taskDetails.HealthStatus -eq "HEALTHY") { "Green" } else { "Yellow" })
                Write-Host "   Demarrage: $($taskDetails.StartedAt)" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "   [ATTENTION] Aucune tache en cours" -ForegroundColor Yellow
            $allChecksPassed = $false
        }
    }
    catch {
        Write-Host "   [ATTENTION] Impossible de recuperer les taches: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================
# 2. VERIFICATION DU CDN CLOUDFRONT
# ============================================
Write-Host ""
Write-Host "2. VERIFICATION DU CDN CLOUDFRONT" -ForegroundColor Cyan
Write-Host "----------------------------------" -ForegroundColor Cyan

# Test CDN Root
$cdnRoot = Test-Endpoint -Name "CDN Root" -URL $CDNURL -TimeoutSeconds 10
if (-not $cdnRoot.Success) {
    Write-Host "   [ATTENTION] Le CDN ne repond pas. Verifiez la configuration CloudFront." -ForegroundColor Yellow
    $allChecksPassed = $false
}

# Test d'un fichier de test
$testFile = "$CDNURL/uploads/test.txt"
$cdnTestFile = Test-Endpoint -Name "CDN Test File" -URL $testFile -TimeoutSeconds 10

# Verifier la distribution CloudFront via AWS CLI
if ($awsCLIAvailable) {
    Write-Host ""
    Write-Host "Distributions CloudFront..." -ForegroundColor Yellow
    try {
        $distributions = aws cloudfront list-distributions --region $Region --query "DistributionList.Items[?contains(Comment, 'yukpomnang') || contains(Comment, 'media') || contains(Comment, 'cdn')]" --output json 2>&1 | ConvertFrom-Json
        
        if ($distributions -and $distributions.Count -gt 0) {
            foreach ($dist in $distributions) {
                $distName = if ($dist.Comment) { $dist.Comment } else { 'Sans nom' }
                Write-Host "   [OK] Distribution: $distName" -ForegroundColor Green
                Write-Host "   Domain: $($dist.DomainName)" -ForegroundColor Gray
                Write-Host "   Statut: $($dist.Status)" -ForegroundColor $(if ($dist.Status -eq "Deployed") { "Green" } else { "Yellow" })
                Write-Host "   Origins: $($dist.Origins.Quantity)" -ForegroundColor Gray
                
                if ($dist.Status -ne "Deployed") {
                    Write-Host "   [ATTENTION] Distribution non deployee" -ForegroundColor Yellow
                    $allChecksPassed = $false
                }
            }
        }
        else {
            Write-Host "   [ATTENTION] Aucune distribution CloudFront trouvee pour yukpomnang" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "   [ATTENTION] Impossible de recuperer les distributions CloudFront: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================
# 3. VERIFICATION DU BUCKET S3
# ============================================
Write-Host ""
Write-Host "3. VERIFICATION DU BUCKET S3" -ForegroundColor Cyan
Write-Host "------------------------------" -ForegroundColor Cyan

if ($awsCLIAvailable) {
    Write-Host "Verification du bucket S3..." -ForegroundColor Yellow
    try {
        $bucketLocation = aws s3api get-bucket-location --bucket $S3Bucket --region $Region --output text 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] Bucket accessible: $S3Bucket" -ForegroundColor Green
            Write-Host "   Region: $bucketLocation" -ForegroundColor Gray
            
            # Compter les objets
            $objectCount = aws s3 ls "s3://$S3Bucket/uploads/" --recursive --summarize --region $Region 2>&1 | Select-String "Total Objects"
            if ($objectCount) {
                Write-Host "   $objectCount" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "   [ERREUR] Bucket non accessible ou n'existe pas: $S3Bucket" -ForegroundColor Red
            Write-Host "   Verifiez les permissions IAM et que le bucket existe" -ForegroundColor Yellow
            $allChecksPassed = $false
        }
    }
    catch {
        Write-Host "   [ATTENTION] Impossible de verifier le bucket S3: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "   [ATTENTION] AWS CLI non disponible - impossible de verifier S3" -ForegroundColor Yellow
}

# ============================================
# 4. VERIFICATION DE LA CONFIGURATION
# ============================================
Write-Host ""
Write-Host "4. VERIFICATION DE LA CONFIGURATION" -ForegroundColor Cyan
Write-Host "-------------------------------------" -ForegroundColor Cyan

Write-Host "Configuration actuelle:" -ForegroundColor Yellow
Write-Host "   Backend URL: $BackendURL" -ForegroundColor Gray
Write-Host "   CDN URL: $CDNURL" -ForegroundColor Gray
Write-Host "   S3 Bucket: $S3Bucket" -ForegroundColor Gray
Write-Host "   Region: $Region" -ForegroundColor Gray
Write-Host "   Cluster: $ClusterName" -ForegroundColor Gray
Write-Host "   Service: $ServiceName" -ForegroundColor Gray

# ============================================
# RESUME FINAL
# ============================================
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "RESUME DE LA VERIFICATION" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

if ($allChecksPassed) {
    Write-Host "[OK] Tous les tests sont passes avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le systeme CDN et Backend AWS sont operationnels." -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] Certains tests ont echoue. Verifiez les details ci-dessus." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions recommendees:" -ForegroundColor Cyan
    Write-Host "   1. Verifiez que le service ECS est en cours d'execution" -ForegroundColor Gray
    Write-Host "   2. Verifiez que l'ALB est correctement configure" -ForegroundColor Gray
    Write-Host "   3. Verifiez que CloudFront est deploye et pointe vers S3" -ForegroundColor Gray
    Write-Host "   4. Verifiez les permissions IAM pour S3" -ForegroundColor Gray
    Write-Host "   5. Consultez les logs CloudWatch pour plus de details" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "   # Voir les logs ECS:" -ForegroundColor Gray
Write-Host "   aws logs tail /ecs/yukpomnang-backend --follow --region $Region" -ForegroundColor White
Write-Host ""
Write-Host "   # Verifier le statut du service:" -ForegroundColor Gray
Write-Host "   aws ecs describe-services --cluster $ClusterName --services $ServiceName --region $Region" -ForegroundColor White
Write-Host ""
Write-Host "   # Lister les distributions CloudFront:" -ForegroundColor Gray
Write-Host "   aws cloudfront list-distributions --region $Region" -ForegroundColor White
Write-Host ""

exit $(if ($allChecksPassed) { 0 } else { 1 })

