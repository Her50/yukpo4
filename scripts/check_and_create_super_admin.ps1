# Script pour verifier et creer le compte super admin dans Cloud SQL
# Usage: .\scripts\check_and_create_super_admin.ps1

$publicIp = "34.79.199.41"
$user = "yukpo_user"
$database = "yukpo_db"
$sqlFile = "scripts\create_super_admin_aws.sql"

Write-Host "Verification et creation du compte super admin..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sqlFile)) {
    Write-Host "Erreur: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

# Generer un mot de passe temporaire pour se connecter
Write-Host "Generation d'un mot de passe temporaire pour la connexion..." -ForegroundColor Yellow
$tempPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})

# Definir le mot de passe temporaire
Write-Host "Definition du mot de passe temporaire sur Cloud SQL..." -ForegroundColor Yellow
$result = gcloud sql users set-password $user --instance=yukpo-postgres --password=$tempPassword --project=yukpo-project 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la definition du mot de passe: $result" -ForegroundColor Red
    exit 1
}

Write-Host "Mot de passe temporaire defini" -ForegroundColor Green
Start-Sleep -Seconds 3

# Verifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "Erreur: psql n'est pas installe" -ForegroundColor Red
    exit 1
}

$env:PGPASSWORD = $tempPassword

# D'abord, verifier si le compte existe
Write-Host ""
Write-Host "Verification de l'existence du compte super admin..." -ForegroundColor Cyan
$checkQuery = "SELECT id, email, role, nom_complet FROM users WHERE email = 'admin@yukpo.dev';"
$checkResult = & psql -h $publicIp -U $user -d $database -p 5432 -t -A -c $checkQuery 2>&1

if ($LASTEXITCODE -eq 0 -and $checkResult -and $checkResult -notmatch "0 rows") {
    Write-Host "Compte super admin trouve:" -ForegroundColor Green
    $checkResult | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    # Verifier le role
    $roleQuery = "SELECT role FROM users WHERE email = 'admin@yukpo.dev';"
    $roleResult = & psql -h $publicIp -U $user -d $database -p 5432 -t -A -c $roleQuery 2>&1
    $role = ($roleResult -split '\s+')[0]
    
    if ($role -eq "super_admin") {
        Write-Host ""
        Write-Host "Compte super admin existe deja avec le bon role!" -ForegroundColor Green
        $env:PGPASSWORD = $null
        exit 0
    } else {
        Write-Host ""
        Write-Host "Compte existe mais avec le role: $role (devrait etre super_admin)" -ForegroundColor Yellow
        Write-Host "Mise a jour du compte..." -ForegroundColor Yellow
    }
} else {
    Write-Host "Compte super admin non trouve. Creation..." -ForegroundColor Yellow
}

# Executer le script SQL pour creer/mettre a jour le compte
Write-Host ""
Write-Host "Application du script SQL..." -ForegroundColor Cyan
$output = & psql -h $publicIp -U $user -d $database -p 5432 -f $sqlFile 2>&1

$output | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Compte super admin cree/mis a jour avec succes!" -ForegroundColor Green
    
    # Verification finale
    Write-Host ""
    Write-Host "Verification finale..." -ForegroundColor Cyan
    $finalCheck = & psql -h $publicIp -U $user -d $database -p 5432 -t -A -c "SELECT id, email, role, nom_complet, tokens_balance FROM users WHERE email = 'admin@yukpo.dev';" 2>&1
    
    if ($finalCheck) {
        Write-Host "Compte super admin:" -ForegroundColor Green
        $finalCheck | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} else {
    Write-Host ""
    Write-Host "Erreur lors de la creation/mise a jour du compte (code: $LASTEXITCODE)" -ForegroundColor Red
}

$env:PGPASSWORD = $null

Write-Host ""
Write-Host "Informations du compte super admin:" -ForegroundColor Cyan
Write-Host "  Email: admin@yukpo.dev" -ForegroundColor White
Write-Host "  Mot de passe: Hernandez87" -ForegroundColor White
Write-Host "  Role: super_admin" -ForegroundColor White
Write-Host "  Tokens: 1,000,000" -ForegroundColor White


