# Script de vérification de la connexion à la base de données Render
# Usage: .\scripts\verify_database_connection.ps1

param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Host "ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Utilisez: `$env:DATABASE_URL = 'postgresql://...'" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== Vérification de la connexion à la base de données ===" -ForegroundColor Cyan
Write-Host ""

# Masquer le mot de passe dans l'URL pour l'affichage
$urlForDisplay = $DatabaseUrl -replace '://([^:]+):([^@]+)@', '://$1:***@'
Write-Host "URL: $urlForDisplay" -ForegroundColor Gray
Write-Host ""

try {
    # 1. Test de connexion basique
    Write-Host "1. Test de connexion..." -ForegroundColor Yellow
    $result = psql $DatabaseUrl -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Connexion réussie!" -ForegroundColor Green
        $result | Select-Object -First 3 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    else {
        Write-Host "   ✗ Échec de connexion" -ForegroundColor Red
        Write-Host "   $result" -ForegroundColor Red
        exit 1
    }
    Write-Host ""

    # 2. Vérifier l'utilisateur actuel
    Write-Host "2. Vérification de l'utilisateur actuel..." -ForegroundColor Yellow
    $user = psql $DatabaseUrl -t -c "SELECT current_user;" 2>&1 | Where-Object { $_.Trim() -ne '' } | Select-Object -First 1
    if ($user -match 'yukpo_db_user') {
        Write-Host "   ✓ Utilisateur correct: $($user.Trim())" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️ Utilisateur: $($user.Trim()) (devrait être yukpo_db_user)" -ForegroundColor Yellow
    }
    Write-Host ""

    # 3. Vérifier les connexions actives
    Write-Host "3. Connexions actives..." -ForegroundColor Yellow
    $connections = psql $DatabaseUrl -c "SELECT usename, datname, state, COUNT(*) as count FROM pg_stat_activity WHERE datname = 'yukpo_db' GROUP BY usename, datname, state ORDER BY count DESC;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ État des connexions:" -ForegroundColor Green
        $connections | Select-Object -Skip 2 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    Write-Host ""

    # 4. Vérifier les migrations appliquées
    Write-Host "4. Migrations appliquées..." -ForegroundColor Yellow
    $migrations = psql $DatabaseUrl -c "SELECT version, description, installed_on, success FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 10;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Dernières migrations:" -ForegroundColor Green
        $migrations | Select-Object -Skip 2 | Select-Object -First 12 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    else {
        Write-Host "   ⚠️ Table _sqlx_migrations non trouvée (normal si migrations SQLx non utilisées)" -ForegroundColor Yellow
    }
    Write-Host ""

    # 5. Vérifier les tables principales
    Write-Host "5. Tables principales..." -ForegroundColor Yellow
    $tables = psql $DatabaseUrl -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 20;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Tables trouvées:" -ForegroundColor Green
        $tables | Select-Object -Skip 2 | Select-Object -First 22 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    Write-Host ""

    # 6. Vérifier les extensions PostgreSQL
    Write-Host "6. Extensions PostgreSQL..." -ForegroundColor Yellow
    $extensions = psql $DatabaseUrl -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Extensions installées:" -ForegroundColor Green
        $extensions | Select-Object -Skip 2 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    Write-Host ""

    # 7. Vérifier les permissions de l'utilisateur
    Write-Host "7. Permissions de l'utilisateur..." -ForegroundColor Yellow
    $permissions = psql $DatabaseUrl -c "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'yukpo_db_user' LIMIT 10;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Permissions:" -ForegroundColor Green
        $permissions | Select-Object -Skip 2 | Select-Object -First 12 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    Write-Host ""

    # 8. Vérifier la taille de la base de données
    Write-Host "8. Taille de la base de données..." -ForegroundColor Yellow
    $size = psql $DatabaseUrl -c "SELECT pg_size_pretty(pg_database_size('yukpo_db')) as size;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Taille:" -ForegroundColor Green
        $size | Select-Object -Skip 2 | Select-Object -First 1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
    Write-Host ""

    Write-Host "=== Vérification terminée ===" -ForegroundColor Green

}
catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

