# Script de Mise a Jour des Variables SSM pour Services Externes
# Date: 2026-02-14
# Objectif: Mettre a jour automatiquement toutes les variables SSM pour le nouveau compte AWS

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpo",
    [string]$Environment = "production"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MISE A JOUR VARIABLES SSM EXTERNES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SSM_PREFIX = "/$ProjectName/$Environment"
$NEW_BACKEND_URL = "https://api.yukpomnang.com"

$updated = @()
$created = @()
$errors = @()

# Variables a mettre a jour
$variablesToUpdate = @(
    @{
        Name = "YOUTUBE_REDIRECT_URI"
        Value = "$NEW_BACKEND_URL/api/social/youtube/callback"
        Type = "String"
        Description = "URL de redirection YouTube OAuth"
    },
    @{
        Name = "GOOGLE_REDIRECT_URI"
        Value = "$NEW_BACKEND_URL/api/auth/google/callback"
        Type = "String"
        Description = "URL de redirection Google OAuth"
    },
    @{
        Name = "APP_BASE_URL"
        Value = $NEW_BACKEND_URL
        Type = "String"
        Description = "URL de base de l'application backend"
    }
)

Write-Host "Mise a jour des Variables SSM..." -ForegroundColor Yellow
Write-Host ""

foreach ($var in $variablesToUpdate) {
    $varName = $var.Name
    $paramName = "$SSM_PREFIX/$varName"
    $value = $var.Value
    $type = $var.Type
    $description = $var.Description
    
    Write-Host "[$varName]..." -ForegroundColor Cyan
    
    # Verifier si la variable existe
    try {
        $existing = aws ssm get-parameter --name $paramName --region $Region --query 'Parameter.Value' --output text 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Variable existe: $existing" -ForegroundColor Gray
            Write-Host "  Nouvelle valeur: $value" -ForegroundColor Gray
            
            # Mettre a jour
            $result = aws ssm put-parameter `
                --name $paramName `
                --value $value `
                --type $type `
                --region $Region `
                --overwrite `
                --description $description 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $updated += $varName
                Write-Host "  [OK] Variable mise a jour avec succes" -ForegroundColor Green
            } else {
                $errors += "${varName}: Erreur lors de la mise a jour - $result"
                Write-Host "  [ERREUR] Erreur lors de la mise a jour: $result" -ForegroundColor Red
            }
        } else {
            # Creer la variable
            Write-Host "  Variable n'existe pas, creation..." -ForegroundColor Gray
            Write-Host "  Valeur: $value" -ForegroundColor Gray
            
            $result = aws ssm put-parameter `
                --name $paramName `
                --value $value `
                --type $type `
                --region $Region `
                --description $description 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $created += $varName
                Write-Host "  [OK] Variable creee avec succes" -ForegroundColor Green
            } else {
                $errors += "${varName}: Erreur lors de la creation - $result"
                Write-Host "  [ERREUR] Erreur lors de la creation: $result" -ForegroundColor Red
            }
        }
    } catch {
        $errorMsg = $_.ToString()
        $errors += "${varName}: Exception - $errorMsg"
        Write-Host "  [ERREUR] Exception: $errorMsg" -ForegroundColor Red
    }
    Write-Host ""
}

# Resume
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($updated.Count -gt 0) {
    Write-Host "Variables mises a jour:" -ForegroundColor Green
    foreach ($var in $updated) {
        Write-Host "  [OK] $var" -ForegroundColor Green
    }
    Write-Host ""
}

if ($created.Count -gt 0) {
    Write-Host "Variables creees:" -ForegroundColor Cyan
    foreach ($var in $created) {
        Write-Host "  [OK] $var" -ForegroundColor Cyan
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "Erreurs:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  [ERREUR] $error" -ForegroundColor Red
    }
    Write-Host ""
}

# Actions suivantes
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ACTIONS SUIVANTES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Mettre a jour Google Cloud Console:" -ForegroundColor Yellow
Write-Host "   - YouTube OAuth: https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
Write-Host "     * Ajouter: $NEW_BACKEND_URL/api/social/youtube/callback" -ForegroundColor Gray
Write-Host "   - Google OAuth: https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
Write-Host "     * Ajouter: $NEW_BACKEND_URL/api/auth/google/callback" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Redemarrer le service ECS pour charger les nouvelles variables:" -ForegroundColor Yellow
Write-Host "   aws ecs update-service \" -ForegroundColor Gray
Write-Host "     --cluster yukpo-cluster \" -ForegroundColor Gray
Write-Host "     --service yukpo-backend-service \" -ForegroundColor Gray
Write-Host "     --region eu-west-1 \" -ForegroundColor Gray
Write-Host "     --force-new-deployment" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Verifier que le DNS api.yukpomnang.com pointe vers le nouveau compte:" -ForegroundColor Yellow
Write-Host "   nslookup api.yukpomnang.com" -ForegroundColor Gray
Write-Host ""

Write-Host "Mise a jour terminee!" -ForegroundColor Cyan

