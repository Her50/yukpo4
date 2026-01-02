# Script pour vérifier si l'utilisateur admin existe déjà
# Ce script peut être exécuté depuis une machine avec accès réseau à Render

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Host "DATABASE_URL non défini. Lecture depuis .env..." -ForegroundColor Yellow
    $envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
    if ($envContent -match "DATABASE_URL=(.+)") {
        $databaseUrl = $matches[1].Trim()
    } else {
        Write-Host "DATABASE_URL non trouvé dans .env" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Vérification si l'utilisateur admin existe..." -ForegroundColor Green

# Utiliser le script Rust pour vérifier
try {
    $result = cargo run --bin create_admin_user 2>&1
    $result | Out-Host
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Succès! L'utilisateur admin a été créé ou mis à jour." -ForegroundColor Green
    } else {
        if ($result -match "Hôte inconnu|Name or service not known") {
            Write-Host "`n⚠️  Problème de connexion réseau à la base de données Render." -ForegroundColor Yellow
            Write-Host "Le script doit être exécuté depuis une machine avec accès réseau à Render." -ForegroundColor Yellow
            Write-Host "`nAlternatives:" -ForegroundColor Cyan
            Write-Host "1. Exécuter le script SQL manuellement via l'interface Render" -ForegroundColor White
            Write-Host "2. Utiliser le script create_super_admin_final.sql créé précédemment" -ForegroundColor White
            Write-Host "3. Vérifier si le compte admin existe déjà en essayant de se connecter avec:" -ForegroundColor White
            Write-Host "   Email: admin@yukpo.dev" -ForegroundColor Gray
            Write-Host "   Mot de passe: Hernandez87" -ForegroundColor Gray
        } else {
            Write-Host "`n❌ Erreur lors de l'exécution du script" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
}





