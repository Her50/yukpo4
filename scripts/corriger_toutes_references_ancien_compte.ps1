# Script pour corriger TOUTES les références à l'ancien compte AWS
# Ancien compte: 846505724644 (us-east-1, yukpomnang-*)
# Nouveau compte: 108964700972 (eu-west-1, yukpo-*)

$ErrorActionPreference = "Continue"

$ANCIEN_COMPTE = "846505724644"
$NOUVEAU_COMPTE = "108964700972"
$ANCIENNE_REGION = "us-east-1"
$NOUVELLE_REGION = "eu-west-1"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔧 Correction de TOUTES les références à l'ancien compte AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""
Write-Host "Ancien compte: $ANCIEN_COMPTE ($ANCIENNE_REGION)" -ForegroundColor Yellow
Write-Host "Nouveau compte: $NOUVEAU_COMPTE ($NOUVELLE_REGION)" -ForegroundColor Green
Write-Host ""

$filesModified = 0
$filesSkipped = 0

# Fonction pour corriger un fichier
function Fix-FileContent {
    param(
        [string]$FilePath
    )
    
    if (-not (Test-Path $FilePath)) {
        return $false
    }
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $originalContent = $content
    $modified = $false
    
    # Corrections
    if ($content -match $ANCIEN_COMPTE) {
        $content = $content -replace $ANCIEN_COMPTE, $NOUVEAU_COMPTE
        $modified = $true
    }
    
    if ($content -match "yukpomnang-cluster") {
        $content = $content -replace "yukpomnang-cluster", "yukpo-cluster"
        $modified = $true
    }
    
    if ($content -match "yukpomnang-backend-service") {
        $content = $content -replace "yukpomnang-backend-service", "yukpo-backend-service"
        $modified = $true
    }
    
    if ($content -match "yukpomnang-ecs-execution-role") {
        $content = $content -replace "yukpomnang-ecs-execution-role", "yukpo-ecs-execution-role"
        $modified = $true
    }
    
    if ($content -match "yukpomnang-ecs-task-role") {
        $content = $content -replace "yukpomnang-ecs-task-role", "yukpo-ecs-task-role"
        $modified = $true
    }
    
    # Corriger les régions dans les scripts PowerShell (mais pas dans les commentaires de documentation)
    if ($FilePath -match "\.ps1$" -and $content -match '\$REGION\s*=\s*["'']us-east-1["'']') {
        $content = $content -replace '\$REGION\s*=\s*["'']us-east-1["'']', "`$REGION = `"$NOUVELLE_REGION`""
        $modified = $true
    }
    
    if ($FilePath -match "\.ps1$" -and $content -match '\$AwsRegion\s*=\s*["'']us-east-1["'']') {
        $content = $content -replace '\$AwsRegion\s*=\s*["'']us-east-1["'']', "`$AwsRegion = `"$NOUVELLE_REGION`""
        $modified = $true
    }
    
    if ($FilePath -match "\.ps1$" -and $content -match '\$Region\s*=\s*["'']us-east-1["'']') {
        $content = $content -replace '\$Region\s*=\s*["'']us-east-1["'']', "`$Region = `"$NOUVELLE_REGION`""
        $modified = $true
    }
    
    if ($modified) {
        Set-Content -Path $FilePath -Value $content -Encoding UTF8 -NoNewline
        return $true
    }
    
    return $false
}

# Trouver tous les fichiers à corriger
$filesToFix = Get-ChildItem -Path "scripts" -Recurse -File | Where-Object {
    $_.Extension -in @(".ps1", ".sh", ".py", ".md", ".json", ".tf", ".tfvars")
} | Where-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content) {
        $content -match $ANCIEN_COMPTE -or 
        $content -match "yukpomnang-cluster" -or 
        $content -match "yukpomnang-backend-service" -or
        ($_.Extension -eq ".ps1" -and $content -match '\$REGION\s*=\s*["'']us-east-1["'']')
    }
}

Write-Host "Fichiers à corriger: $($filesToFix.Count)" -ForegroundColor Cyan
Write-Host ""

foreach ($file in $filesToFix) {
    Write-Host "📝 $($file.FullName)..." -ForegroundColor White
    if (Fix-FileContent -FilePath $file.FullName) {
        $filesModified++
        Write-Host "   ✅ Modifié" -ForegroundColor Green
    } else {
        $filesSkipped++
        Write-Host "   ⚠️ Aucune modification nécessaire" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""
Write-Host "Fichiers modifiés: $filesModified" -ForegroundColor Green
Write-Host "Fichiers ignorés: $filesSkipped" -ForegroundColor Yellow
Write-Host ""

