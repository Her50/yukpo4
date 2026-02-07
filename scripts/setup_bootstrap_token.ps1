# Script pour configurer le token BOOTSTRAP_SUPER_ADMIN_TOKEN dans SSM Parameter Store
# Usage: .\scripts\setup_bootstrap_token.ps1 [-Token "your-token-here"]

param(
    [string]$Token = "",
    [string]$Region = "us-east-1",
    [string]$ProjectName = "yukpomnang",
    [string]$Environment = "production"
)

Write-Host "[SETUP] Configuration du token BOOTSTRAP_SUPER_ADMIN_TOKEN" -ForegroundColor Green
Write-Host ""

# Générer un token aléatoire si non fourni
if ([string]::IsNullOrEmpty($Token)) {
    Write-Host "[INFO] Generation d'un token aleatoire..." -ForegroundColor Yellow
    
    # Générer un token aléatoire de 64 caractères
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $tokenArray = 1..64 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] }
    $Token = -join $tokenArray
    
    Write-Host "[OK] Token genere: $Token" -ForegroundColor Green
} else {
    Write-Host "[INFO] Utilisation du token fourni" -ForegroundColor Yellow
}

$parameterName = "/$ProjectName/$Environment/BOOTSTRAP_SUPER_ADMIN_TOKEN"

Write-Host ""
Write-Host "[RUN] Stockage du token dans SSM Parameter Store..." -ForegroundColor Green
Write-Host "   Parameter: $parameterName" -ForegroundColor Cyan
Write-Host "   Region: $Region" -ForegroundColor Cyan
Write-Host ""

try {
    # Vérifier si le paramètre existe déjà
    $existing = aws ssm get-parameter --name $parameterName --region $Region --with-decryption --query Parameter.Value --output text 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[WARNING] Le parametre existe deja!" -ForegroundColor Yellow
        $confirm = Read-Host "Voulez-vous le mettre a jour? (O/N)"
        if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
            Write-Host "[CANCEL] Operation annulee" -ForegroundColor Red
            exit 0
        }
        
        # Mettre à jour le paramètre
        aws ssm put-parameter `
            --name $parameterName `
            --value $Token `
            --type "SecureString" `
            --overwrite `
            --region $Region `
            --description "Token secret pour l'endpoint bootstrap-super-admin (temporaire)" `
            2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Token mis a jour avec succes!" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Erreur lors de la mise a jour" -ForegroundColor Red
            exit 1
        }
    } else {
        # Créer le paramètre
        aws ssm put-parameter `
            --name $parameterName `
            --value $Token `
            --type "SecureString" `
            --region $Region `
            --description "Token secret pour l'endpoint bootstrap-super-admin (temporaire)" `
            2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Token cree avec succes!" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Erreur lors de la creation" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "=== Configuration terminee ===" -ForegroundColor Cyan
    Write-Host "Parameter: $parameterName" -ForegroundColor White
    Write-Host "Token: $Token" -ForegroundColor White
    Write-Host ""
    Write-Host "[INFO] Pour utiliser ce token avec le script call_bootstrap_super_admin.ps1:" -ForegroundColor Yellow
    Write-Host "   .\scripts\call_bootstrap_super_admin.ps1 -SecretToken `"$Token`"" -ForegroundColor White
    Write-Host ""
    Write-Host "[WARNING] IMPORTANT: Ce token doit etre ajoute a la task definition ECS!" -ForegroundColor Yellow
    Write-Host "   Ajoutez dans les secrets de la task definition:" -ForegroundColor White
    Write-Host "   {`"name`": `"BOOTSTRAP_SUPER_ADMIN_TOKEN`", `"valueFrom`": `"arn:aws:ssm:$Region:ACCOUNT_ID:parameter$parameterName`"}" -ForegroundColor White
    
} catch {
    Write-Host "[ERROR] Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Operation terminee!" -ForegroundColor Green

