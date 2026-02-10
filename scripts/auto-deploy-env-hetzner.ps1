# Script Automatique : Déploiement .env sur Hetzner
# Utilise WSL (Ubuntu) ou déclenche GitHub Actions

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Déploiement Automatique .env Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier WSL
$wslAvailable = $false
try {
    $wslCheck = wsl --list --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        $wslAvailable = $true
        Write-Host "✅ WSL détecté" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ WSL non disponible" -ForegroundColor Yellow
}

# Méthode 1 : Utiliser WSL (Ubuntu) pour SSH
if ($wslAvailable) {
    Write-Host ""
    Write-Host "[Méthode 1] Utilisation de WSL (Ubuntu)..." -ForegroundColor Yellow
    Write-Host ""
    
    # Vérifier que le script bash existe
    if (-not (Test-Path "create-env-hetzner.sh")) {
        Write-Host "❌ create-env-hetzner.sh introuvable" -ForegroundColor Red
        Write-Host "Génération du script..." -ForegroundColor Yellow
        powershell -ExecutionPolicy Bypass -File .\scripts\generate-hetzner-env.ps1
    }
    
    if (Test-Path "create-env-hetzner.sh") {
        Write-Host "✅ Script bash trouvé" -ForegroundColor Green
        
        # Copier le script dans WSL
        Write-Host "📋 Copie du script dans WSL..." -ForegroundColor Cyan
        $wslScript = wsl bash -c "cat > /tmp/create-env-hetzner.sh" < create-env-hetzner.sh 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Script copié dans WSL" -ForegroundColor Green
            
            # Vérifier la clé SSH dans WSL
            Write-Host "🔑 Vérification clé SSH..." -ForegroundColor Cyan
            $sshKeyWsl = wsl bash -c "if [ -f ~/.ssh/hetzner_deploy ]; then echo 'OK'; else echo 'MISSING'; fi" 2>&1
            
            if ($sshKeyWsl -match "OK") {
                Write-Host "✅ Clé SSH trouvée dans WSL" -ForegroundColor Green
                
                # Exécuter le script sur Hetzner via WSL
                Write-Host "🚀 Déploiement sur Hetzner via WSL..." -ForegroundColor Cyan
                Write-Host "   (Cela peut prendre 30-60 secondes)" -ForegroundColor Gray
                
                $deployCmd = @'
cd /tmp
chmod +x create-env-hetzner.sh
scp -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=accept-new create-env-hetzner.sh root@46.224.14.85:/tmp/ 2>&1
if [ $? -eq 0 ]; then
  ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no root@46.224.14.85 'bash /tmp/create-env-hetzner.sh' 2>&1
  echo "DEPLOY_SUCCESS"
else
  echo "DEPLOY_FAILED"
fi
'@
                
                $result = wsl bash -c $deployCmd 2>&1
                
                if ($result -match "DEPLOY_SUCCESS" -or $result -match "Fichier .env cree") {
                    Write-Host "✅ Déploiement réussi via WSL!" -ForegroundColor Green
                    
                    # Vérification
                    Write-Host "🔍 Vérification..." -ForegroundColor Cyan
                    $verify = wsl bash -c "ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no root@46.224.14.85 'ls -lh /opt/yukpo/.env && wc -l /opt/yukpo/.env'" 2>&1
                    Write-Host $verify
                    
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Green
                    Write-Host "✅ TERMINÉ AVEC SUCCÈS!" -ForegroundColor Green
                    Write-Host "========================================" -ForegroundColor Green
                    exit 0
                } else {
                    Write-Host "❌ Échec du déploiement via WSL" -ForegroundColor Red
                    Write-Host $result
                }
            } else {
                Write-Host "⚠️ Clé SSH non trouvée dans WSL" -ForegroundColor Yellow
                Write-Host "   Copiez la clé: wsl bash -c 'cp /mnt/c/Users/$env:USERNAME/.ssh/hetzner_deploy ~/.ssh/ && chmod 600 ~/.ssh/hetzner_deploy'" -ForegroundColor Gray
            }
        }
    }
}

# Méthode 2 : Déclencher GitHub Actions automatiquement
Write-Host ""
Write-Host "[Méthode 2] Déclenchement GitHub Actions..." -ForegroundColor Yellow
Write-Host ""

# Vérifier si GitHub token est disponible
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Host "⚠️ GITHUB_TOKEN non défini" -ForegroundColor Yellow
    Write-Host "   Le workflow GitHub Actions sera disponible manuellement" -ForegroundColor Gray
    Write-Host "   https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Cyan
} else {
    Write-Host "🔑 Token GitHub trouvé" -ForegroundColor Green
    
    $repo = "Her50/yukpo4"
    $workflow = "deploy-env-hetzner.yml"
    
    Write-Host "🚀 Déclenchement du workflow GitHub Actions..." -ForegroundColor Cyan
    
    $headers = @{
        "Accept" = "application/vnd.github.v3+json"
        "Authorization" = "token $githubToken"
    }
    
    $body = @{
        ref = "main"
        inputs = @{
            force = "false"
        }
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/workflows/$workflow/dispatches" `
            -Method Post `
            -Headers $headers `
            -Body $body `
            -ContentType "application/json"
        
        Write-Host "✅ Workflow déclenché avec succès!" -ForegroundColor Green
        Write-Host "   Suivez le déploiement: https://github.com/$repo/actions" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "⏳ Le déploiement prendra 2-3 minutes..." -ForegroundColor Yellow
        exit 0
    } catch {
        Write-Host "❌ Erreur lors du déclenchement: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Méthode 3 : Instructions manuelles
Write-Host ""
Write-Host "[Méthode 3] Instructions manuelles..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Si les méthodes automatiques ont échoué:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Via GitHub Actions (Recommandé):" -ForegroundColor Yellow
Write-Host "   https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Cyan
Write-Host "   Cliquez sur 'Run workflow' -> 'Run workflow'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Via WSL manuellement:" -ForegroundColor Yellow
Write-Host "   wsl" -ForegroundColor Cyan
Write-Host "   scp create-env-hetzner.sh root@46.224.14.85:/tmp/" -ForegroundColor Cyan
Write-Host "   ssh root@46.224.14.85 'bash /tmp/create-env-hetzner.sh'" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "⚠️ Déploiement non automatique" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

