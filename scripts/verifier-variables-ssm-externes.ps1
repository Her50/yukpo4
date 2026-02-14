# Script de Verification des Variables SSM pour Services Externes
# Date: 2026-02-14
# Objectif: Verifier que toutes les variables SSM pointent vers le nouveau compte AWS

param(
    [string]$Region = "eu-west-1",
    [string]$ProjectName = "yukpo",
    [string]$Environment = "production"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION VARIABLES SSM EXTERNES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SSM_PREFIX = "/$ProjectName/$Environment"
$NEW_BACKEND_URL = "https://api.yukpomnang.com"
$OLD_RENDER_URL = "yukpomnang.onrender.com"
$OLD_ALB_URL = "yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"

$issues = @()
$warnings = @()
$success = @()

# Variables a verifier
$variablesToCheck = @(
    @{ Name = "YOUTUBE_REDIRECT_URI"; ExpectedPattern = $NEW_BACKEND_URL; Critical = $true },
    @{ Name = "GOOGLE_REDIRECT_URI"; ExpectedPattern = $NEW_BACKEND_URL; Critical = $true },
    @{ Name = "UPLOAD_BASE_URL"; ExpectedPattern = "yukpo-backend-media"; Critical = $true },
    @{ Name = "PUBLIC_BASE_URL"; ExpectedPattern = "yukpo-backend-media|api.yukpomnang.com"; Critical = $false },
    @{ Name = "APP_BASE_URL"; ExpectedPattern = $NEW_BACKEND_URL; Critical = $true }
)

Write-Host "Verification des Variables SSM..." -ForegroundColor Yellow
Write-Host ""

foreach ($var in $variablesToCheck) {
    $varName = $var.Name
    $paramName = "$SSM_PREFIX/$varName"
    $critical = $var.Critical
    
    Write-Host "[$varName]..." -ForegroundColor Cyan
    
    try {
        $result = aws ssm get-parameter --name $paramName --region $Region --query 'Parameter.Value' --output text 2>&1
        if ($LASTEXITCODE -eq 0) {
            $value = $result.Trim()
            Write-Host "  Valeur: $value" -ForegroundColor Gray
            
            # Verifier si contient l'ancien URL
            if ($value -like "*$OLD_RENDER_URL*") {
                $msg = "$varName pointe vers Render (ancien): $value"
                if ($critical) {
                    $issues += $msg
                    Write-Host "  [ERREUR] $msg" -ForegroundColor Red
                } else {
                    $warnings += $msg
                    Write-Host "  [ATTENTION] $msg" -ForegroundColor Yellow
                }
            }
            elseif ($value -like "*$OLD_ALB_URL*") {
                $msg = "$varName pointe vers l'ancien ALB: $value"
                if ($critical) {
                    $issues += $msg
                    Write-Host "  [ERREUR] $msg" -ForegroundColor Red
                } else {
                    $warnings += $msg
                    Write-Host "  [ATTENTION] $msg" -ForegroundColor Yellow
                }
            }
            elseif ($value -like "*$($var.ExpectedPattern)*") {
                $success += "$varName est correctement configure"
                Write-Host "  [OK] Configure correctement" -ForegroundColor Green
            }
            else {
                $warnings += "$varName ne correspond pas au pattern attendu: $value"
                Write-Host "  [ATTENTION] Ne correspond pas au pattern attendu" -ForegroundColor Yellow
            }
        } else {
            $msg = "$varName n'existe pas dans SSM"
            if ($critical) {
                $issues += $msg
                Write-Host "  [ERREUR] $msg" -ForegroundColor Red
            } else {
                $warnings += $msg
                Write-Host "  [ATTENTION] $msg" -ForegroundColor Yellow
            }
        }
    } catch {
        $errorMsg = $_.ToString()
        $msg = "${varName}: Erreur lors de la verification - $errorMsg"
        $issues += $msg
        Write-Host "  [ERREUR] $msg" -ForegroundColor Red
    }
    Write-Host ""
}

# Resume
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "Variables correctement configurees:" -ForegroundColor Green
    foreach ($msg in $success) {
        Write-Host "  [OK] $msg" -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "Avertissements:" -ForegroundColor Yellow
    foreach ($msg in $warnings) {
        Write-Host "  [ATTENTION] $msg" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($issues.Count -gt 0) {
    Write-Host "Problemes critiques:" -ForegroundColor Red
    foreach ($msg in $issues) {
        Write-Host "  [ERREUR] $msg" -ForegroundColor Red
    }
    Write-Host ""
}

# Actions requises
if ($issues.Count -gt 0 -or $warnings.Count -gt 0) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ACTIONS REQUISES" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "1. Mettre a jour les variables SSM avec les nouvelles URLs:" -ForegroundColor Yellow
    Write-Host ""
    
    if ($issues -like "*YOUTUBE_REDIRECT_URI*" -or $warnings -like "*YOUTUBE_REDIRECT_URI*") {
        Write-Host "   YOUTUBE_REDIRECT_URI:" -ForegroundColor Cyan
        Write-Host "   aws ssm put-parameter \" -ForegroundColor Gray
        Write-Host "     --name `"$SSM_PREFIX/YOUTUBE_REDIRECT_URI`" \" -ForegroundColor Gray
        Write-Host "     --value `"$NEW_BACKEND_URL/api/social/youtube/callback`" \" -ForegroundColor Gray
        Write-Host "     --type `"String`" \" -ForegroundColor Gray
        Write-Host "     --region $Region \" -ForegroundColor Gray
        Write-Host "     --overwrite" -ForegroundColor Gray
        Write-Host ""
    }
    
    if ($issues -like "*GOOGLE_REDIRECT_URI*" -or $warnings -like "*GOOGLE_REDIRECT_URI*") {
        Write-Host "   GOOGLE_REDIRECT_URI:" -ForegroundColor Cyan
        Write-Host "   aws ssm put-parameter \" -ForegroundColor Gray
        Write-Host "     --name `"$SSM_PREFIX/GOOGLE_REDIRECT_URI`" \" -ForegroundColor Gray
        Write-Host "     --value `"$NEW_BACKEND_URL/api/auth/google/callback`" \" -ForegroundColor Gray
        Write-Host "     --type `"String`" \" -ForegroundColor Gray
        Write-Host "     --region $Region \" -ForegroundColor Gray
        Write-Host "     --overwrite" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "2. Mettre a jour Google Cloud Console:" -ForegroundColor Yellow
    Write-Host "   - YouTube OAuth: https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
    Write-Host "   - Google OAuth: https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
    Write-Host "   - Ajouter les nouveaux redirect URIs:" -ForegroundColor Gray
    Write-Host "     * $NEW_BACKEND_URL/api/social/youtube/callback" -ForegroundColor Gray
    Write-Host "     * $NEW_BACKEND_URL/api/auth/google/callback" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Verification terminee!" -ForegroundColor Cyan

