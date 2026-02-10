# Script pour vérifier et configurer SSH Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vérification SSH Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la clé privée locale
Write-Host "[1/4] Vérification clé privée locale..." -ForegroundColor Yellow
$privateKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
if (Test-Path $privateKeyPath) {
    Write-Host "  ✅ Clé privée trouvée: $privateKeyPath" -ForegroundColor Green
    $keyContent = Get-Content $privateKeyPath -Raw
    if ($keyContent -match "BEGIN OPENSSH PRIVATE KEY") {
        Write-Host "  ✅ Format de clé valide" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Format de clé suspect" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Clé privée non trouvée!" -ForegroundColor Red
    Write-Host "  💡 Générez une nouvelle clé avec:" -ForegroundColor Cyan
    Write-Host "     ssh-keygen -t ed25519 -f $privateKeyPath -C 'github-actions-hetzner'" -ForegroundColor Gray
    exit 1
}

# 2. Vérifier la clé publique locale
Write-Host ""
Write-Host "[2/4] Vérification clé publique locale..." -ForegroundColor Yellow
$publicKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy.pub"
if (Test-Path $publicKeyPath) {
    Write-Host "  ✅ Clé publique trouvée: $publicKeyPath" -ForegroundColor Green
    $publicKey = Get-Content $publicKeyPath
    Write-Host "  📋 Clé publique:" -ForegroundColor Cyan
    Write-Host "     $publicKey" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  ⚠️ IMPORTANT: Cette clé doit être dans ~/.ssh/authorized_keys sur Hetzner" -ForegroundColor Yellow
} else {
    Write-Host "  ❌ Clé publique non trouvée!" -ForegroundColor Red
    exit 1
}

# 3. Vérifier GitHub Secrets
Write-Host ""
Write-Host "[3/4] Vérification GitHub Secrets..." -ForegroundColor Yellow
Write-Host "  ℹ️ Vérifiez manuellement sur:" -ForegroundColor Cyan
Write-Host "     https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Gray
Write-Host ""
Write-Host "  📝 Le secret doit s'appeler: HETZNER_SSH_PRIVATE_KEY" -ForegroundColor Yellow
Write-Host "  📝 La valeur doit être le contenu complet de la clé privée (avec BEGIN/END)" -ForegroundColor Yellow
Write-Host ""

# Afficher la clé privée pour copier
Write-Host "  📋 Contenu de la clé privée à copier dans GitHub Secrets:" -ForegroundColor Cyan
Write-Host "  " -NoNewline
Write-Host ("=" * 60) -ForegroundColor Gray
Get-Content $privateKeyPath | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Gray
}
Write-Host "  " -NoNewline
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# 4. Tester la connexion SSH
Write-Host "[4/4] Test de connexion SSH..." -ForegroundColor Yellow
Write-Host "  🔍 Tentative de connexion à root@46.224.14.85..." -ForegroundColor Cyan

# Vérifier si ssh est disponible
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    $testResult = ssh -i $privateKeyPath -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@46.224.14.85 "echo 'SSH_OK'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Connexion SSH réussie!" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Connexion SSH échouée" -ForegroundColor Red
        Write-Host "  💡 Vérifiez que la clé publique est sur Hetzner:" -ForegroundColor Yellow
        Write-Host "     1. Connectez-vous à Hetzner: ssh root@46.224.14.85" -ForegroundColor Gray
        Write-Host "     2. Vérifiez: cat ~/.ssh/authorized_keys" -ForegroundColor Gray
        Write-Host "     3. Si la clé n'est pas là, ajoutez-la:" -ForegroundColor Gray
        Write-Host "        echo '$publicKey' >> ~/.ssh/authorized_keys" -ForegroundColor Gray
        Write-Host "        chmod 600 ~/.ssh/authorized_keys" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️ SSH non disponible dans PowerShell" -ForegroundColor Yellow
    Write-Host "  💡 Testez manuellement avec WSL ou Git Bash" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Résumé" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Actions à faire:" -ForegroundColor Yellow
Write-Host "  1. Copier la clé privée ci-dessus dans GitHub Secrets" -ForegroundColor White
Write-Host "  2. Vérifier que la clé publique est sur Hetzner" -ForegroundColor White
Write-Host "  3. Relancer le workflow GitHub Actions" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Liens utiles:" -ForegroundColor Cyan
Write-Host "  - GitHub Secrets: https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Gray
Write-Host "  - Workflow: https://github.com/Her50/yukpo4/actions/workflows/docker-build-optimized.yml" -ForegroundColor Gray
Write-Host ""

