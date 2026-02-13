# 🔄 Script de Transfert des Variables d'Environnement AWS
# Ancien Compte → Nouveau Compte
# PowerShell Version

param(
    [string]$OldRegion = "us-east-1",
    [string]$NewRegion = "eu-west-1",
    [string]$OldProfile = "ancien-compte",
    [string]$NewProfile = "default",
    [string]$OldPath = "/yukpomnang/production",
    [string]$NewPath = "/yukpo/production",
    [string]$OldSecretName = "yukpomnang/backend/secrets",
    [string]$NewSecretName = "yukpo/backend/secrets"
)

Write-Host "🔄 Début du transfert des variables..." -ForegroundColor Cyan
Write-Host "Ancien compte: $OldProfile ($OldRegion)" -ForegroundColor Yellow
Write-Host "Nouveau compte: $NewProfile ($NewRegion)" -ForegroundColor Green
Write-Host ""

# 1. Transférer SSM Parameter Store
Write-Host "📋 Étape 1: Récupération SSM Parameter Store de l'ancien compte..." -ForegroundColor Cyan

try {
    $params = aws ssm get-parameters-by-path `
        --path $OldPath `
        --region $OldRegion `
        --profile $OldProfile `
        --recursive `
        --with-decryption `
        --output json | ConvertFrom-Json
    
    if ($params.Parameters) {
        Write-Host "   ✅ $($params.Parameters.Count) paramètre(s) trouvé(s)" -ForegroundColor Green
        
        foreach ($param in $params.Parameters) {
            $newName = $param.Name -replace [regex]::Escape($OldPath), $NewPath
            Write-Host "   📝 Transfert: $newName" -ForegroundColor Yellow
            
            # Échapper les guillemets dans la valeur
            $value = $param.Value -replace '"', '\"'
            
            aws ssm put-parameter `
                --name $newName `
                --value $value `
                --type $param.Type `
                --region $NewRegion `
                --profile $NewProfile `
                --overwrite | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "      ✅ Transféré" -ForegroundColor Green
            } else {
                Write-Host "      ⚠️  Erreur" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⚠️  Aucun paramètre trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors de la récupération: $_" -ForegroundColor Red
    Write-Host "   Vérifiez vos credentials et la région" -ForegroundColor Yellow
}

Write-Host ""

# 2. Transférer Secrets Manager
Write-Host "📋 Étape 2: Transfert Secrets Manager..." -ForegroundColor Cyan

try {
    $secretValue = aws secretsmanager get-secret-value `
        --secret-id $OldSecretName `
        --region $OldRegion `
        --profile $OldProfile `
        --query 'SecretString' `
        --output text
    
    if ($secretValue -and $secretValue -ne "None") {
        Write-Host "   ✅ Secret récupéré" -ForegroundColor Green
        
        aws secretsmanager put-secret-value `
            --secret-id $NewSecretName `
            --secret-string $secretValue `
            --region $NewRegion `
            --profile $NewProfile | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Secret transféré" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Erreur lors du transfert du secret" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠️  Aucun secret trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer le secret: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Transfert terminé !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Vérification des variables transférées:" -ForegroundColor Cyan
aws ssm get-parameters-by-path `
    --path $NewPath `
    --region $NewRegion `
    --profile $NewProfile `
    --recursive `
    --query 'Parameters[*].Name' `
    --output table

