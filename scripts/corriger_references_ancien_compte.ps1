# Script pour corriger toutes les références à l'ancien compte AWS
# Ancien compte: 846505724644 (us-east-1)
# Nouveau compte: 108964700972 (eu-west-1)

$ErrorActionPreference = "Continue"

$ANCIEN_COMPTE = "846505724644"
$NOUVEAU_COMPTE = "108964700972"
$ANCIENNE_REGION = "us-east-1"
$NOUVELLE_REGION = "eu-west-1"
$ANCIEN_CLUSTER = "yukpomnang-cluster"
$NOUVEAU_CLUSTER = "yukpo-cluster"
$ANCIEN_SERVICE = "yukpomnang-backend-service"
$NOUVEAU_SERVICE = "yukpo-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔧 Correction des références à l'ancien compte AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""
Write-Host "Ancien compte: $ANCIEN_COMPTE ($ANCIENNE_REGION)" -ForegroundColor Yellow
Write-Host "Nouveau compte: $NOUVEAU_COMPTE ($NOUVELLE_REGION)" -ForegroundColor Green
Write-Host ""

$filesModified = 0
$filesSkipped = 0

# Fonction pour corriger un fichier
function Fix-File {
    param(
        [string]$FilePath,
        [string[]]$Patterns
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "   ⚠️ Fichier non trouvé: $FilePath" -ForegroundColor Yellow
        return $false
    }
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $originalContent = $content
    $modified = $false
    
    foreach ($pattern in $Patterns) {
        if ($content -match $pattern.Old) {
            $content = $content -replace $pattern.Old, $pattern.New
            $modified = $true
            Write-Host "   ✅ Corrigé: $($pattern.Description)" -ForegroundColor Green
        }
    }
    
    if ($modified) {
        Set-Content -Path $FilePath -Value $content -Encoding UTF8 -NoNewline
        return $true
    }
    
    return $false
}

# Patterns de correction
$patterns = @(
    @{ Old = $ANCIEN_COMPTE; New = $NOUVEAU_COMPTE; Description = "Account ID" },
    @{ Old = $ANCIENNE_REGION; New = $NOUVELLE_REGION; Description = "Région AWS" },
    @{ Old = $ANCIEN_CLUSTER; New = $NOUVEAU_CLUSTER; Description = "Nom du cluster ECS" },
    @{ Old = $ANCIEN_SERVICE; New = $NOUVEAU_SERVICE; Description = "Nom du service ECS" },
    @{ Old = "yukpomnang-backend-alb-2043939972\.us-east-1\.elb\.amazonaws\.com"; New = "18.201.235.152:8080"; Description = "URL ALB ancien compte" }
)

# Liste des fichiers à corriger
$filesToFix = @(
    @{ Path = "scripts/fix_iam_and_apply_migrations.ps1"; Patterns = @(
        @{ Old = '\$ACCOUNT_ID = "846505724644"'; New = "`$ACCOUNT_ID = `"$NOUVEAU_COMPTE`""; Description = "Account ID" },
        @{ Old = '\$REGION = "us-east-1"'; New = "`$REGION = `"$NOUVELLE_REGION`""; Description = "Région" },
        @{ Old = "yukpomnang-cluster"; New = $NOUVEAU_CLUSTER; Description = "Cluster" },
        @{ Old = "yukpomnang-backend-service"; New = $NOUVEAU_SERVICE; Description = "Service" }
    )},
    @{ Path = "scripts/apply_migrations_auto.ps1"; Patterns = @(
        @{ Old = '\$REGION = "us-east-1"'; New = "`$REGION = `"$NOUVELLE_REGION`""; Description = "Région" },
        @{ Old = "846505724644"; New = $NOUVEAU_COMPTE; Description = "Account ID" },
        @{ Old = "us-east-1"; New = $NOUVELLE_REGION; Description = "Région dans ARN" }
    )},
    @{ Path = "scripts/build-push-ecr.ps1"; Patterns = @(
        @{ Old = '\$AWS_ACCOUNT_ID = "846505724644"'; New = "`$AWS_ACCOUNT_ID = `"$NOUVEAU_COMPTE`""; Description = "Account ID" }
    )},
    @{ Path = "scripts/copy-ecr-image-cross-region.ps1"; Patterns = @(
        @{ Old = '\$AccountId = "846505724644"'; New = "`$AccountId = `"$NOUVEAU_COMPTE`""; Description = "Account ID" },
        @{ Old = '\$TargetRegion = "us-east-1"'; New = "`$TargetRegion = `"$NOUVELLE_REGION`""; Description = "Région cible" }
    )}
)

Write-Host "Correction des fichiers scripts..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $filesToFix) {
    Write-Host "📝 $($file.Path)..." -ForegroundColor White
    if (Fix-File -FilePath $file.Path -Patterns $file.Patterns) {
        $filesModified++
    } else {
        $filesSkipped++
    }
    Write-Host ""
}

# Corriger les fichiers avec région par défaut
$regionFiles = @(
    "scripts/final-migrate-env.ps1",
    "scripts/auto-migrate-hetzner-fixed.ps1",
    "scripts/auto-migrate-hetzner.ps1",
    "scripts/apply_delivery_migrations_via_ecs_task.ps1",
    "scripts/restart_ecs_and_apply_migrations.ps1",
    "scripts/apply_delivery_migrations_via_ecs.ps1",
    "scripts/apply_delivery_config_migrations_aws.ps1",
    "scripts/set_launch_phase_start_date.ps1",
    "scripts/update_all_env_variables_aws.ps1",
    "scripts/setup_bootstrap_token.ps1",
    "scripts/find-delivery-config-error.ps1",
    "scripts/get-delivery-error-logs.ps1",
    "scripts/verify_external_services_aws.ps1",
    "scripts/apply-all-optimizations.ps1",
    "scripts/fix_database_url_aws.ps1",
    "scripts/copy-ecr-image-cross-region.ps1",
    "scripts/verify-aws-cdn-backend-simple.ps1"
)

Write-Host "Correction des fichiers avec région par défaut..." -ForegroundColor Cyan
Write-Host ""

foreach ($filePath in $regionFiles) {
    Write-Host "📝 $filePath..." -ForegroundColor White
    $patterns = @(
        @{ Old = '\$Region\s*=\s*["'']us-east-1["'']'; New = "`$Region = `"$NOUVELLE_REGION`""; Description = "Région" },
        @{ Old = '\$AwsRegion\s*=\s*["'']us-east-1["'']'; New = "`$AwsRegion = `"$NOUVELLE_REGION`""; Description = "Région AWS" },
        @{ Old = '\$TargetRegion\s*=\s*["'']us-east-1["'']'; New = "`$TargetRegion = `"$NOUVELLE_REGION`""; Description = "Région cible" },
        @{ Old = '\$OldRegion\s*=\s*["'']us-east-1["'']'; New = "`$OldRegion = `"$NOUVELLE_REGION`""; Description = "Ancienne région" }
    )
    if (Fix-File -FilePath $filePath -Patterns $patterns) {
        $filesModified++
    } else {
        $filesSkipped++
    }
    Write-Host ""
}

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""
Write-Host "Fichiers modifiés: $filesModified" -ForegroundColor Green
Write-Host "Fichiers ignorés (déjà corrects ou non trouvés): $filesSkipped" -ForegroundColor Yellow
Write-Host ""

