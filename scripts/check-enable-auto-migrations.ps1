# Script PowerShell pour vérifier et mettre à jour ENABLE_AUTO_MIGRATIONS dans AWS Secrets Manager
# Usage: .\scripts\check-enable-auto-migrations.ps1

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$SECRET_NAME = "${PROJECT_NAME}/backend/secrets"
$SECRET_KEY = "ENABLE_AUTO_MIGRATIONS"

Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "🔍 Vérification de ENABLE_AUTO_MIGRATIONS dans AWS Secrets Manager" -ForegroundColor Cyan
Write-Host ("=" * 80)
Write-Host ""

# Vérifier que AWS CLI est configuré
try {
    $accountId = aws sts get-caller-identity --region $REGION --query 'Account' --output text
    Write-Host "✅ AWS CLI configuré (Account: $accountId)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: AWS CLI non configuré ou non authentifié" -ForegroundColor Red
    Write-Host "   Exécutez: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Récupérer le secret
Write-Host "🔍 Récupération du secret: $SECRET_NAME" -ForegroundColor Cyan
try {
    $secretValue = aws secretsmanager get-secret-value `
        --secret-id $SECRET_NAME `
        --region $REGION `
        --query 'SecretString' `
        --output text | ConvertFrom-Json
    
    if ($secretValue.$SECRET_KEY) {
        $currentValue = $secretValue.$SECRET_KEY
        Write-Host "✅ ENABLE_AUTO_MIGRATIONS trouvé: '$currentValue'" -ForegroundColor Green
        
        # Vérifier la valeur
        $currentValueLower = $currentValue.ToString().Trim().ToLower()
        if ($currentValueLower -eq "true" -or $currentValueLower -eq "1" -or $currentValueLower -eq "yes" -or $currentValueLower -eq "on") {
            Write-Host "✅ ENABLE_AUTO_MIGRATIONS est activé (valeur: '$currentValue')" -ForegroundColor Green
        } else {
            Write-Host "⚠️ ENABLE_AUTO_MIGRATIONS est désactivé (valeur: '$currentValue')" -ForegroundColor Yellow
            Write-Host ""
            $update = Read-Host "Voulez-vous l'activer? (O/N)"
            if ($update -eq "O" -or $update -eq "o" -or $update -eq "Y" -or $update -eq "y") {
                $secretValue.$SECRET_KEY = "true"
                $newSecretJson = $secretValue | ConvertTo-Json -Compress
                
                Write-Host "🔄 Mise à jour du secret..." -ForegroundColor Cyan
                aws secretsmanager put-secret-value `
                    --secret-id $SECRET_NAME `
                    --secret-string $newSecretJson `
                    --region $REGION | Out-Null
                
                Write-Host "✅ ENABLE_AUTO_MIGRATIONS mis à jour à 'true'" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "⚠️ ENABLE_AUTO_MIGRATIONS non trouvé dans le secret" -ForegroundColor Yellow
        Write-Host ""
        $add = Read-Host "Voulez-vous l'ajouter avec la valeur 'true'? (O/N)"
        if ($add -eq "O" -or $add -eq "o" -or $add -eq "Y" -or $add -eq "y") {
            $secretValue | Add-Member -MemberType NoteProperty -Name $SECRET_KEY -Value "true" -Force
            $newSecretJson = $secretValue | ConvertTo-Json -Compress
            
            Write-Host "🔄 Ajout de ENABLE_AUTO_MIGRATIONS au secret..." -ForegroundColor Cyan
            aws secretsmanager put-secret-value `
                --secret-id $SECRET_NAME `
                --secret-string $newSecretJson `
                --region $REGION | Out-Null
            
            Write-Host "✅ ENABLE_AUTO_MIGRATIONS ajouté avec la valeur 'true'" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ Erreur lors de la récupération du secret: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifications:" -ForegroundColor Yellow
    Write-Host "  1. Le secret '$SECRET_NAME' existe-t-il dans AWS Secrets Manager?" -ForegroundColor Yellow
    Write-Host "  2. Avez-vous les permissions nécessaires?" -ForegroundColor Yellow
    Write-Host "  3. La région est-elle correcte? ($REGION)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host ("=" * 80)
Write-Host "✅ Vérification terminée" -ForegroundColor Green
Write-Host ("=" * 80)

