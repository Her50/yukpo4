# Script pour definir LAUNCH_PHASE_START_DATE dans AWS SSM Parameter Store
# Date de reference : 10/02/2026 (10 fevrier 2026)
# Usage: .\scripts\set_launch_phase_start_date.ps1 [-AutoConfirm]

param(
    [switch]$AutoConfirm = $false
)

$ErrorActionPreference = "Stop"

$ParameterName = "/yukpomnang/production/LAUNCH_PHASE_START_DATE"
$LaunchDate = "2026-02-10T00:00:00Z"  # 10 fevrier 2026 a 00:00:00 UTC
$Region = "us-east-1"
$Description = "Date de debut de la phase de lancement - Apres 3 mois (10/05/2026), seuls les nouveaux utilisateurs auront droit a 1 produit gratuit"

Write-Host "🚀 Configuration de LAUNCH_PHASE_START_DATE dans AWS SSM" -ForegroundColor Cyan
Write-Host ""
Write-Host "Parametre: $ParameterName" -ForegroundColor White
Write-Host "Date de debut: $LaunchDate (10 fevrier 2026)" -ForegroundColor White
Write-Host "Date de fin: 2026-05-10T00:00:00Z (10 mai 2026 - 3 mois apres)" -ForegroundColor White
Write-Host "Region: $Region" -ForegroundColor White
Write-Host ""

# Verifier si le parametre existe deja
Write-Host "🔍 Verification de l'existence du parametre..." -ForegroundColor Yellow
$existingCheck = aws ssm get-parameter --name $ParameterName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    $existingJson = $existingCheck | ConvertFrom-Json
    $currentValue = $existingJson.Parameter.Value
    Write-Host "⚠️  Le parametre existe deja avec la valeur: $currentValue" -ForegroundColor Yellow
    Write-Host ""
    if (-not $AutoConfirm) {
        $confirm = Read-Host "Voulez-vous le mettre a jour? (O/N)"
        if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
            Write-Host "[CANCEL] Operation annulee" -ForegroundColor Red
            exit 0
        }
    }
    Write-Host "🔄 Mise a jour du parametre..." -ForegroundColor Cyan
} else {
    Write-Host "✅ Le parametre n'existe pas, creation..." -ForegroundColor Green
}

# Creer ou mettre a jour le parametre
$result = aws ssm put-parameter `
    --name $ParameterName `
    --value $LaunchDate `
    --type String `
    --description $Description `
    --region $Region `
    --overwrite `
    --query "Version" `
    --output text 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Parametre cree/mis a jour avec succes!" -ForegroundColor Green
    Write-Host "   Version: $result" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Resume de la configuration:" -ForegroundColor Cyan
    Write-Host "   - Date de debut: 10 fevrier 2026 00:00:00 UTC" -ForegroundColor White
    Write-Host "   - Date de fin: 10 mai 2026 00:00:00 UTC (3 mois apres)" -ForegroundColor White
    Write-Host "   - Pendant la phase (10/02 - 10/05):" -ForegroundColor White
    Write-Host "     • Tous les prestataires peuvent creer/reactiver gratuitement" -ForegroundColor Green
    Write-Host "   - Apres la phase (apres 10/05):" -ForegroundColor White
    Write-Host "     • Nouveaux utilisateurs: 1 produit gratuit + 0 tokens" -ForegroundColor Yellow
    Write-Host "     • Anciens utilisateurs (crees avant 10/05): toujours gratuits" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Redemarrer le backend ECS pour que la variable soit prise en compte" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "❌ Erreur lors de la creation/mise a jour: $result" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Operation terminee!" -ForegroundColor Green
