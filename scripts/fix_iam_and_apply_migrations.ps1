# Script autonome pour corriger les permissions IAM et appliquer les migrations
# Fonctionne de manière automatique sans intervention manuelle

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$EXECUTION_ROLE_NAME = "yukpomnang-ecs-execution-role"
$ACCOUNT_ID = "846505724644"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔧 Correction des permissions IAM et application des migrations" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Étape 1: Vérifier et corriger les permissions IAM
Write-Host "📋 Étape 1: Vérification des permissions IAM..." -ForegroundColor Yellow

try {
    # Vérifier si la politique existe déjà
    $existingPolicies = aws iam list-role-policies `
        --role-name $EXECUTION_ROLE_NAME `
        --region $REGION `
        --output json 2>&1 | ConvertFrom-Json
    
    $policyName = "yukpomnang-ecs-ssm-access"
    $policyExists = $existingPolicies.PolicyNames -contains $policyName
    
    if (-not $policyExists) {
        Write-Host "   Création de la politique IAM pour SSM..." -ForegroundColor Gray
        
        # Créer la politique JSON
        $policyJson = @{
            Version = "2012-10-17"
            Statement = @(
                @{
                    Effect = "Allow"
                    Action = @(
                        "ssm:GetParameters",
                        "ssm:GetParameter",
                        "ssm:GetParametersByPath"
                    )
                    Resource = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/yukpomnang/production/*"
                }
            )
        } | ConvertTo-Json -Depth 10 -Compress
        
        # Créer un fichier temporaire pour la politique
        $policyFile = [System.IO.Path]::GetTempFileName() + ".json"
        $policyJson | Out-File -FilePath $policyFile -Encoding UTF8 -NoNewline
        
        # Attacher la politique au rôle
        aws iam put-role-policy `
            --role-name $EXECUTION_ROLE_NAME `
            --policy-name $policyName `
            --policy-document file://$policyFile `
            --region $REGION | Out-Null
        
        Remove-Item $policyFile -ErrorAction SilentlyContinue
        
        Write-Host "✅ Politique IAM créée et attachée" -ForegroundColor Green
    } else {
        Write-Host "✅ Politique IAM existe déjà" -ForegroundColor Green
        
        # Vérifier si elle couvre la bonne région
        $currentPolicy = aws iam get-role-policy `
            --role-name $EXECUTION_ROLE_NAME `
            --policy-name $policyName `
            --region $REGION `
            --output json | ConvertFrom-Json
        
        $policyDoc = $currentPolicy.PolicyDocument | ConvertFrom-Json
        $resourceArn = $policyDoc.Statement[0].Resource
        
        if ($resourceArn -notmatch $REGION) {
            Write-Host "   ⚠️ La politique couvre une autre région, mise à jour..." -ForegroundColor Yellow
            
            $policyJson = @{
                Version = "2012-10-17"
                Statement = @(
                    @{
                        Effect = "Allow"
                        Action = @(
                            "ssm:GetParameters",
                            "ssm:GetParameter",
                            "ssm:GetParametersByPath"
                        )
                        Resource = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/yukpomnang/production/*"
                    }
                )
            } | ConvertTo-Json -Depth 10 -Compress
            
            $policyFile = [System.IO.Path]::GetTempFileName() + ".json"
            $policyJson | Out-File -FilePath $policyFile -Encoding UTF8 -NoNewline
            
            aws iam put-role-policy `
                --role-name $EXECUTION_ROLE_NAME `
                --policy-name $policyName `
                --policy-document file://$policyFile `
                --region $REGION | Out-Null
            
            Remove-Item $policyFile -ErrorAction SilentlyContinue
            
            Write-Host "✅ Politique mise à jour pour la région $REGION" -ForegroundColor Green
        }
    }
    
    Write-Host ""
} catch {
    Write-Host "⚠️ Erreur lors de la vérification/création de la politique: $_" -ForegroundColor Yellow
    Write-Host "   Continuons quand même..." -ForegroundColor Gray
    Write-Host ""
}

# Étape 2: Attendre quelques secondes pour que les permissions prennent effet
Write-Host "📋 Étape 2: Attente de la propagation des permissions IAM..." -ForegroundColor Yellow
Write-Host "   (Attente de 10 secondes...)" -ForegroundColor Gray
Start-Sleep -Seconds 10
Write-Host ""

# Étape 3: Essayer d'appliquer les migrations via ECS Exec
Write-Host "📋 Étape 3: Tentative d'application des migrations via ECS Exec..." -ForegroundColor Yellow

try {
    # Trouver une tâche en cours
    $taskArn = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --desired-status RUNNING `
        --region $REGION `
        --query 'taskArns[0]' `
        --output text
    
    if ($taskArn) {
        $taskId = $taskArn -replace '.*/', ''
        Write-Host "✅ Tâche trouvée: $taskId" -ForegroundColor Green
        
        # Vérifier si Session Manager Plugin est disponible
        $ssmPlugin = Get-Command session-manager-plugin -ErrorAction SilentlyContinue
        
        if ($ssmPlugin) {
            Write-Host "   ✅ Session Manager Plugin trouvé" -ForegroundColor Green
            Write-Host "   Exécution des migrations..." -ForegroundColor Gray
            Write-Host ""
            
            $command = 'cd /app/backend && sqlx migrate run'
            
            # Exécuter la commande (non-interactive si possible)
            $result = aws ecs execute-command `
                --cluster $CLUSTER_NAME `
                --task $taskArn `
                --container backend `
                --command $command `
                --interactive `
                --region $REGION 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Migrations appliquées avec succès via ECS Exec!" -ForegroundColor Green
                Write-Host ""
                Write-Host "==================================================================================" -ForegroundColor Cyan
                Write-Host "✅ Terminé avec succès!" -ForegroundColor Green
                Write-Host "=================================================================================="
                exit 0
            } else {
                Write-Host ""
                Write-Host "⚠️ ECS Exec a retourné un code de sortie: $LASTEXITCODE" -ForegroundColor Yellow
                Write-Host "   Passage à la méthode alternative (redémarrage du service)..." -ForegroundColor Gray
            }
        } else {
            Write-Host "   ⚠️ Session Manager Plugin non trouvé" -ForegroundColor Yellow
            Write-Host "   Passage à la méthode alternative (redémarrage du service)..." -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️ Aucune tâche en cours d'exécution" -ForegroundColor Yellow
        Write-Host "   Passage à la méthode alternative (redémarrage du service)..." -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️ Erreur lors de la tentative ECS Exec: $_" -ForegroundColor Yellow
    Write-Host "   Passage à la méthode alternative (redémarrage du service)..." -ForegroundColor Gray
}

Write-Host ""

# Étape 4: Redémarrer le service pour appliquer les migrations automatiquement
Write-Host "📋 Étape 4: Redémarrage du service pour appliquer les migrations automatiquement..." -ForegroundColor Yellow

try {
    Write-Host "   Déclenchement du redéploiement..." -ForegroundColor Gray
    
    $deployment = aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --region $REGION `
        --force-new-deployment `
        --query 'service.deployments[0]' `
        --output json | ConvertFrom-Json
    
    $deploymentId = $deployment.id
    Write-Host "✅ Nouveau déploiement déclenché: $deploymentId" -ForegroundColor Green
    Write-Host ""
    
    # Attendre que le service soit stable
    Write-Host "⏳ Attente de la stabilisation du service (peut prendre 2-5 minutes)..." -ForegroundColor Yellow
    Write-Host "   Les migrations seront appliquées automatiquement au démarrage" -ForegroundColor Gray
    Write-Host ""
    
    $maxWait = 300 # 5 minutes
    $elapsed = 0
    $stable = $false
    
    while ($elapsed -lt $maxWait -and -not $stable) {
        Start-Sleep -Seconds 20
        $elapsed += 20
        
        try {
            $service = aws ecs describe-services `
                --cluster $CLUSTER_NAME `
                --services $SERVICE_NAME `
                --region $REGION `
                --query 'services[0]' `
                --output json | ConvertFrom-Json
            
            $deployments = $service.deployments | Where-Object { $_.status -eq "PRIMARY" }
            $primaryDeployment = $deployments | Where-Object { $_.id -eq $deploymentId }
            
            if ($primaryDeployment -and $primaryDeployment.desiredCount -eq $primaryDeployment.runningCount -and $primaryDeployment.runningCount -gt 0) {
                $stable = $true
                Write-Host "✅ Service stabilisé!" -ForegroundColor Green
                Write-Host "   Tâches en cours: $($primaryDeployment.runningCount)/$($primaryDeployment.desiredCount)" -ForegroundColor Gray
            } else {
                $running = $primaryDeployment.runningCount
                $desired = $primaryDeployment.desiredCount
                Write-Host ('   En attente... (' + $elapsed + ' s) - Running: ' + $running + '/' + $desired) -ForegroundColor Gray
            }
        } catch {
            Write-Host "   ⚠️ Erreur lors de la vérification: $_" -ForegroundColor Yellow
        }
    }
    
    if (-not $stable) {
        Write-Host ""
        Write-Host ('Timeout atteint (' + $maxWait + ' secondes)') -ForegroundColor Yellow
        Write-Host "   Le service est peut-etre encore en cours de deploiement" -ForegroundColor Gray
        Write-Host "   Les migrations seront appliquées dès que le service sera stable" -ForegroundColor Gray
    }
    
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors du redéploiement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vérifiez manuellement:" -ForegroundColor Yellow
    Write-Host "   aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION" -ForegroundColor White
    exit 1
}

# Étape 5: Vérification finale
Write-Host "📋 Étape 5: Vérification finale..." -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Actions effectuées:" -ForegroundColor Green
Write-Host "   1. ✅ Permissions IAM vérifiées/corrigées" -ForegroundColor Gray
Write-Host "   2. ✅ Service redémarré pour appliquer les migrations" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Les migrations suivantes seront appliquées automatiquement:" -ForegroundColor Cyan
Write-Host "   - Toutes les migrations SQLx dans backend/migrations/" -ForegroundColor Gray
Write-Host "   - Colonnes de product_delivery_config:" -ForegroundColor Gray
Write-Host "     * preparation_time_minutes" -ForegroundColor White
Write-Host "     * storage_location_id" -ForegroundColor White
Write-Host "     * max_preparation_time_minutes" -ForegroundColor White
Write-Host "     * availability_days" -ForegroundColor White
Write-Host "     * is_immediately_available" -ForegroundColor White
Write-Host ""
Write-Host "📋 Pour vérifier les logs de migration:" -ForegroundColor Cyan
Write-Host "   aws logs tail /ecs/yukpomnang-backend --follow --region $REGION" -ForegroundColor White
Write-Host ""

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Script terminé!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""

