# Script de diagnostic pour vérifier pourquoi run_audio_cache_cleanup() n'existe pas
# Usage: .\backend\scripts\diagnose_audio_cache_function.ps1

Write-Host "🔍 Diagnostic de la fonction run_audio_cache_cleanup()" -ForegroundColor Cyan
Write-Host ""

# Vérifier si la fonction existe dans la base de données
Write-Host "1️⃣ Vérification de l'existence de la fonction dans PostgreSQL..." -ForegroundColor Yellow

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL n'est pas définie" -ForegroundColor Red
    exit 1
}

# Extraire les informations de connexion
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $username = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "   Host: $host" -ForegroundColor Gray
    Write-Host "   Database: $database" -ForegroundColor Gray
    Write-Host "   Port: $port" -ForegroundColor Gray
} else {
    Write-Host "❌ Impossible de parser DATABASE_URL" -ForegroundColor Red
    exit 1
}

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "⚠️ psql n'est pas disponible. Installation de psql requise pour ce diagnostic." -ForegroundColor Yellow
    Write-Host "   Vous pouvez installer PostgreSQL client ou utiliser une autre méthode." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Requête SQL à exécuter manuellement:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   -- Vérifier si la fonction existe" -ForegroundColor Gray
    Write-Host "   SELECT proname, prosrc FROM pg_proc WHERE proname = 'run_audio_cache_cleanup';" -ForegroundColor White
    Write-Host ""
    Write-Host "   -- Vérifier les migrations SQLx appliquées" -ForegroundColor Gray
    Write-Host "   SELECT version, description, success FROM _sqlx_migrations ORDER BY version DESC LIMIT 10;" -ForegroundColor White
    Write-Host ""
    Write-Host "   -- Vérifier si ENABLE_AUTO_MIGRATIONS est activé (via logs ou env)" -ForegroundColor Gray
    Write-Host "   -- Chercher dans les logs: 'ENABLE_AUTO_MIGRATIONS' ou '🚀 Démarrage des migrations automatiques'" -ForegroundColor White
    exit 0
}

# Exporter le mot de passe pour psql
$env:PGPASSWORD = $password

Write-Host ""
Write-Host "2️⃣ Vérification de l'existence de la fonction..." -ForegroundColor Yellow
$functionCheck = & psql -h $host -p $port -U $username -d $database -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname = 'run_audio_cache_cleanup';" 2>&1

if ($LASTEXITCODE -eq 0) {
    $functionExists = $functionCheck.Trim()
    if ($functionExists -eq "1") {
        Write-Host "   ✅ La fonction run_audio_cache_cleanup() EXISTE dans la base de données" -ForegroundColor Green
    } else {
        Write-Host "   ❌ La fonction run_audio_cache_cleanup() N'EXISTE PAS dans la base de données" -ForegroundColor Red
    }
} else {
    Write-Host "   ⚠️ Erreur lors de la vérification: $functionCheck" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3️⃣ Vérification des migrations SQLx appliquées..." -ForegroundColor Yellow
$migrationsCheck = & psql -h $host -p $port -U $username -d $database -c "SELECT version, description, success, applied_at FROM _sqlx_migrations ORDER BY version DESC LIMIT 10;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $migrationsCheck
} else {
    Write-Host "   ⚠️ Erreur lors de la vérification des migrations: $migrationsCheck" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4️⃣ Vérification de l'extension pgvector..." -ForegroundColor Yellow
$pgvectorCheck = & psql -h $host -p $port -U $username -d $database -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector';" 2>&1

if ($LASTEXITCODE -eq 0) {
    $pgvectorExists = $pgvectorCheck.Trim()
    if ($pgvectorExists -eq "1") {
        Write-Host "   ✅ Extension pgvector installée" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Extension pgvector non installée (peut être normal)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️ Erreur lors de la vérification: $pgvectorCheck" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5️⃣ Recommandations:" -ForegroundColor Cyan
Write-Host "   - Vérifier dans les logs AWS si '🚀 Démarrage des migrations automatiques' apparaît" -ForegroundColor White
Write-Host "   - Vérifier si 'ENABLE_AUTO_MIGRATIONS=true' est défini dans les variables d'environnement AWS" -ForegroundColor White
Write-Host "   - Vérifier si '✅ Migration auto: audio search cache optimization OK' apparaît dans les logs" -ForegroundColor White
Write-Host "   - Si la fonction n'existe pas, exécuter le script de correction:" -ForegroundColor White
Write-Host "     backend\apply_audio_fix_direct.sql" -ForegroundColor Yellow

# Nettoyer
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

