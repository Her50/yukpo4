# Script de vérification automatique de la configuration GitHub Actions
# Vérifie : Git, Workflow, AWS, et donne des instructions pour configurer les secrets

Write-Host ""
Write-Host "=== Vérification Configuration GitHub Actions ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Vérification Git
Write-Host "[1/6] Configuration Git..." -ForegroundColor Yellow
try {
    $gitUser = git config --global user.name
    $gitEmail = git config --global user.email
    
    if ($gitUser -and $gitEmail) {
        Write-Host "  [OK] Git configure : $gitUser <$gitEmail>" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Git non configure" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "  [ERROR] Erreur lors de la verification Git" -ForegroundColor Red
    $allGood = $false
}

# 2. Vérification Remote Git
Write-Host ""
Write-Host "[2/6] Remote Git..." -ForegroundColor Yellow
try {
    $remotes = git remote -v
    if ($remotes -match "github.com") {
        Write-Host "  [OK] Remote GitHub configure" -ForegroundColor Green
        $remotes | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    } else {
        Write-Host "  [WARN] Remote GitHub non trouve" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "  [ERROR] Erreur lors de la verification des remotes" -ForegroundColor Red
    $allGood = $false
}

# 3. Vérification Workflow GitHub Actions
Write-Host ""
Write-Host "[3/6] Workflow GitHub Actions..." -ForegroundColor Yellow
$workflowPath = ".github/workflows/docker-build-optimized.yml"
if (Test-Path $workflowPath) {
    Write-Host "  [OK] Workflow trouve : $workflowPath" -ForegroundColor Green
    
    # Vérifier que le workflow contient le job deploy-to-ecs
    $workflowContent = Get-Content $workflowPath -Raw
    if ($workflowContent -match "deploy-to-ecs") {
        Write-Host "  [OK] Job 'deploy-to-ecs' present (deploiement automatique)" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Job 'deploy-to-ecs' non trouve" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [ERROR] Workflow non trouve : $workflowPath" -ForegroundColor Red
    $allGood = $false
}

# 4. Vérification Credentials AWS (locaux)
Write-Host ""
Write-Host "[4/6] Credentials AWS (locaux)..." -ForegroundColor Yellow
try {
    $awsIdentity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        $identity = $awsIdentity | ConvertFrom-Json
        Write-Host "  [OK] AWS configure : $($identity.Arn)" -ForegroundColor Green
        Write-Host "    Account: $($identity.Account)" -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] AWS non configure localement" -ForegroundColor Yellow
        Write-Host "    (Ce n'est pas bloquant pour GitHub Actions)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [WARN] Impossible de verifier AWS localement" -ForegroundColor Yellow
}

# 5. Vérification Infrastructure AWS
Write-Host ""
Write-Host "[5/6] Infrastructure AWS..." -ForegroundColor Yellow
try {
    # Vérifier ECR
    $ecr = aws ecr describe-repositories --repository-names yukpomnang-backend --region eu-west-1 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Repository ECR existe" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Repository ECR non trouve" -ForegroundColor Yellow
    }
    
    # Vérifier Cluster ECS
    $clusters = aws ecs list-clusters --region eu-west-1 2>&1 | ConvertFrom-Json
    if ($clusters.clusterArns -like "*yukpomnang*") {
        Write-Host "  [OK] Cluster ECS existe" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Cluster ECS non trouve" -ForegroundColor Yellow
    }
    
    # Vérifier Service ECS
    $services = aws ecs list-services --cluster yukpomnang-cluster --region eu-west-1 2>&1 | ConvertFrom-Json
    if ($services.serviceArns -like "*yukpomnang-backend-service*") {
        Write-Host "  [OK] Service ECS existe" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Service ECS non trouve" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] Impossible de verifier l'infrastructure AWS" -ForegroundColor Yellow
}

# 6. Instructions pour les secrets GitHub
Write-Host ""
Write-Host "[6/6] Secrets GitHub (à configurer manuellement)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  [ACTION REQUISE] Configurer les secrets dans GitHub" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Etapes :" -ForegroundColor Cyan
Write-Host "  1. Allez sur : https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor White
Write-Host "  2. Cliquez sur 'New repository secret'" -ForegroundColor White
Write-Host "  3. Ajoutez ces 2 secrets :" -ForegroundColor White
Write-Host ""
Write-Host "     Secret 1 :" -ForegroundColor Yellow
Write-Host "       Name:  AWS_ACCESS_KEY_ID" -ForegroundColor Gray
Write-Host "       Value: [Votre Access Key ID AWS]" -ForegroundColor Gray
Write-Host ""
Write-Host "     Secret 2 :" -ForegroundColor Yellow
Write-Host "       Name:  AWS_SECRET_ACCESS_KEY" -ForegroundColor Gray
Write-Host "       Value: [Votre Secret Access Key AWS]" -ForegroundColor Gray
Write-Host ""
Write-Host "  [INFO] Pour obtenir les credentials AWS :" -ForegroundColor Cyan
Write-Host "     - AWS Console > IAM > Users > Votre utilisateur > Security credentials" -ForegroundColor Gray
Write-Host "     - Ou utilisez les credentials existants si vous en avez" -ForegroundColor Gray
Write-Host ""

# Résumé
Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Magenta
Write-Host ""

if ($allGood) {
    Write-Host "[OK] Configuration locale : OK" -ForegroundColor Green
} else {
    Write-Host "[WARN] Configuration locale : A completer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checklist :" -ForegroundColor Cyan
$secretsColor = if ($allGood) { "Yellow" } else { "Yellow" }
Write-Host "  [ ] Secrets GitHub configures (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)" -ForegroundColor $secretsColor
Write-Host "  [ ] Workflow GitHub Actions present" -ForegroundColor $(if (Test-Path $workflowPath) { "Green" } else { "Red" })
Write-Host "  [ ] Infrastructure AWS deployee" -ForegroundColor "Green"
Write-Host ""

Write-Host "Prochaines etapes :" -ForegroundColor Yellow
Write-Host "  1. Configurer les secrets GitHub (voir ci-dessus)" -ForegroundColor White
Write-Host "  2. Faire un test push :" -ForegroundColor White
Write-Host "     git add ." -ForegroundColor Gray
Write-Host "     git commit -m 'test: vérification GitHub Actions'" -ForegroundColor Gray
Write-Host "     git push origin main" -ForegroundColor Gray
Write-Host "  3. Vérifier dans GitHub > Actions" -ForegroundColor White
Write-Host ""

Write-Host "Documentation :" -ForegroundColor Cyan
Write-Host "  - .github/SETUP-RAPIDE.md (guide rapide)" -ForegroundColor Gray
Write-Host "  - .github/CONFIGURATION-GIT-GITHUB-ACTIONS.md (guide complet)" -ForegroundColor Gray
Write-Host ""

