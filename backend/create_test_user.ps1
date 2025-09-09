# Script pour créer un utilisateur de test
# Usage: .\create_test_user.ps1

Write-Host "📝 Création d'un utilisateur de test pour Yukpo..." -ForegroundColor Yellow

# Charger les variables d'environnement
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    Write-Host "✅ Variables d'environnement chargées depuis .env" -ForegroundColor Green
} else {
    Write-Host "⚠️ Fichier .env non trouvé" -ForegroundColor Yellow
}

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "❌ DATABASE_URL non défini dans .env" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Connexion à la base de données..." -ForegroundColor Cyan
Write-Host "Database URL: $dbUrl" -ForegroundColor Gray

try {
    # Utiliser psql pour exécuter le script
    $result = psql $dbUrl -f "create_test_user.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Utilisateur de test créé avec succès!" -ForegroundColor Green
        Write-Host "" -ForegroundColor White
        Write-Host "📋 Informations de connexion:" -ForegroundColor Cyan
        Write-Host "   Email: admin@yukpo.dev" -ForegroundColor White
        Write-Host "   Mot de passe: password123" -ForegroundColor White
        Write-Host "   Rôle: admin" -ForegroundColor White
        Write-Host "   Tokens: 10000 XAF" -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la création de l'utilisateur" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}
