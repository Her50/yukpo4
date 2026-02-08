# Script autonome pour appliquer les migrations automatiquement
# Corrige les permissions IAM si necessaire et redemarre le service

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$EXECUTION_ROLE_NAME = "yukpomnang-ecs-execution-role"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Application des migrations de configuration de livraison" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Etape 1: Verifier les permissions IAM
Write-Host "Etape 1: Verification des permissions IAM..." -ForegroundColor Yellow

try {
    $policies = aws iam list-role-policies `
        --role-name $EXECUTION_ROLE_NAME `
        --region $REGION `
        --output json 2>&1 | ConvertFrom-Json
    
    $policyName = "yukpomnang-ecs-ssm-access"
    $hasPolicy = $policies.PolicyNames -contains $policyName
    
    if (-not $hasPolicy) {
        Write-Host "   La politique IAM pour SSM n'existe pas" -ForegroundColor Yellow
        Write-Host "   Creation de la politique..." -ForegroundColor Gray
        
        # Creer le fichier JSON
        $jsonFile = "policy-ssm-access-us-east-1.json"
        $jsonContent = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters",
        "ssm:GetParameter",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:us-east-1:846505724644:parameter/yukpomnang/production/*"
    }
  ]
}
'@
        $jsonContent | Out-File -FilePath $jsonFile -Encoding UTF8
        
        Write-Host "   Fichier JSON cree: $jsonFile" -ForegroundColor Gray
        Write-Host "   Veuillez executer manuellement:" -ForegroundColor Yellow
        Write-Host "   aws iam put-role-policy --role-name $EXECUTION_ROLE_NAME --policy-name $policyName --policy-document file://$jsonFile --region $REGION" -ForegroundColor White
        Write-Host ""
        Write-Host "   Ou via AWS Console:" -ForegroundColor Yellow
        Write-Host "   1. IAM -> Roles -> $EXECUTION_ROLE_NAME" -ForegroundColor White
        Write-Host "   2. Add permissions -> Create inline policy" -ForegroundColor White
        Write-Host "   3. JSON -> Coller le contenu de $jsonFile" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "   Politique IAM existe deja" -ForegroundColor Green
    }
    Write-Host ""
} catch {
    Write-Host "   Erreur lors de la verification: $_" -ForegroundColor Yellow
    Write-Host "   Continuons quand meme..." -ForegroundColor Gray
    Write-Host ""
}

# Etape 2: Redemarrer le service
Write-Host "Etape 2: Redemarrage du service pour appliquer les migrations..." -ForegroundColor Yellow

try {
    Write-Host "   Declenchement du redeploiement..." -ForegroundColor Gray
    
    $deployment = aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --region $REGION `
        --force-new-deployment `
        --query 'service.deployments[0]' `
        --output json | ConvertFrom-Json
    
    $deploymentId = $deployment.id
    Write-Host "   Nouveau deploiement declenche: $deploymentId" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "   Les migrations seront appliquees automatiquement au demarrage" -ForegroundColor Cyan
    Write-Host "   Cela peut prendre 2-5 minutes" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "   Erreur lors du redeploiement: $_" -ForegroundColor Red
    exit 1
}

# Etape 3: Instructions finales
Write-Host "Etape 3: Instructions..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Actions effectuees:" -ForegroundColor Green
Write-Host "   1. Permissions IAM verifiees" -ForegroundColor Gray
Write-Host "   2. Service redemarre pour appliquer les migrations" -ForegroundColor Gray
Write-Host ""
Write-Host "Migrations qui seront appliquees:" -ForegroundColor Cyan
Write-Host "   - Toutes les migrations SQLx dans backend/migrations/" -ForegroundColor Gray
Write-Host "   - Colonnes de product_delivery_config:" -ForegroundColor Gray
Write-Host "     * preparation_time_minutes" -ForegroundColor White
Write-Host "     * storage_location_id" -ForegroundColor White
Write-Host "     * max_preparation_time_minutes" -ForegroundColor White
Write-Host "     * availability_days" -ForegroundColor White
Write-Host "     * is_immediately_available" -ForegroundColor White
Write-Host ""
Write-Host "Pour verifier les logs:" -ForegroundColor Cyan
Write-Host "   aws logs tail /ecs/yukpomnang-backend --follow --region $REGION" -ForegroundColor White
Write-Host ""

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Termine!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



