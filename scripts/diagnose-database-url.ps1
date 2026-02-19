# Script de Diagnostic : DATABASE_URL
# Date: 2026-02-18
# Objectif: Vérifier le format et le contenu de DATABASE_URL

$PROJECT = "yukpo-project"
$SECRET_NAME = "database-url"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic DATABASE_URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier les versions du secret
Write-Host "[1/4] Vérification des versions du secret '$SECRET_NAME'..." -ForegroundColor Yellow
try {
    $versions = gcloud secrets versions list $SECRET_NAME --project=$PROJECT --format="value(name)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $latestVersion = ($versions | Select-Object -First 1)
        Write-Host "✅ Dernière version: $latestVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la récupération des versions" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Récupérer le contenu du secret (sans afficher le mot de passe complet)
Write-Host "[2/4] Analyse du format DATABASE_URL..." -ForegroundColor Yellow
try {
    $dbUrl = gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        # Masquer le mot de passe pour l'affichage
        if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@') {
            $user = $matches[1]
            $password = $matches[2]
            $passwordMasked = if ($password.Length -gt 4) { 
                $password.Substring(0, 2) + "***" + $password.Substring($password.Length - 2) 
            } else { 
                "***" 
            }
            $dbUrlMasked = $dbUrl -replace [regex]::Escape($password), $passwordMasked
            Write-Host "✅ DATABASE_URL récupéré (mot de passe masqué):" -ForegroundColor Green
            Write-Host "   $dbUrlMasked" -ForegroundColor Gray
        } else {
            Write-Host "⚠️ Format DATABASE_URL non reconnu" -ForegroundColor Yellow
            Write-Host "   Longueur: $($dbUrl.Length) caractères" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Erreur lors de la récupération du secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Analyser le format
Write-Host "[3/4] Analyse du format..." -ForegroundColor Yellow
$isUnixSocket = $dbUrl -match 'host=/cloudsql/'
$hasDatabase = $dbUrl -match '@/([^?]+)\?'
$hasUser = $dbUrl -match 'postgresql://([^:]+):'

if ($isUnixSocket) {
    Write-Host "✅ Format Unix socket détecté" -ForegroundColor Green
    if ($dbUrl -match 'host=(/cloudsql/[^&]+)') {
        $socketPath = $matches[1]
        Write-Host "   Socket: $socketPath" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️ Format IP/hostname (pas Unix socket)" -ForegroundColor Yellow
}

if ($hasDatabase) {
    $dbName = $matches[1]
    Write-Host "✅ Base de données: $dbName" -ForegroundColor Green
    if ($dbName -eq "yukpo_postgres") {
        Write-Host "   ✅ Base principale (recommandée)" -ForegroundColor Green
    } elseif ($dbName -eq "yukpo_db") {
        Write-Host "   ⚠️ Base ancienne (considérer migration vers yukpo_postgres)" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️ Base inconnue" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Base de données non trouvée dans DATABASE_URL" -ForegroundColor Red
}

if ($hasUser) {
    $user = $matches[1]
    Write-Host "✅ Utilisateur: $user" -ForegroundColor Green
    if ($user -eq "yukpo_user") {
        Write-Host "   ✅ Utilisateur correct" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Utilisateur différent de 'yukpo_user'" -ForegroundColor Yellow
    }
}
Write-Host ""

# 4. Vérifier les bases de données dans Cloud SQL
Write-Host "[4/4] Vérification des bases de données dans Cloud SQL..." -ForegroundColor Yellow
try {
    $databases = gcloud sql databases list --instance=yukpo-postgres --project=$PROJECT --format="value(name)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Bases de données disponibles:" -ForegroundColor Green
        foreach ($db in $databases) {
            if ($db -eq "yukpo_postgres") {
                Write-Host "   ✅ $db (principale)" -ForegroundColor Green
            } elseif ($db -eq "yukpo_db") {
                Write-Host "   ⚠️ $db (ancienne)" -ForegroundColor Yellow
            } else {
                Write-Host "   - $db" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "⚠️ Impossible de récupérer la liste des bases de données" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Erreur lors de la vérification: $_" -ForegroundColor Yellow
}
Write-Host ""

# Résumé et recommandations
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Recommandations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$recommendations = @()

if (-not $isUnixSocket) {
    $recommendations += "⚠️ Utiliser le format Unix socket pour Cloud SQL (plus sécurisé)"
}

if ($hasDatabase -and $dbName -ne "yukpo_postgres") {
    $recommendations += "⚠️ Utiliser la base 'yukpo_postgres' au lieu de '$dbName'"
}

if ($recommendations.Count -eq 0) {
    Write-Host "✅ Format DATABASE_URL semble correct" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si l'authentification échoue toujours, le problème peut être:" -ForegroundColor Yellow
    Write-Host "1. Le mot de passe dans DATABASE_URL ne correspond pas à celui dans Cloud SQL" -ForegroundColor White
    Write-Host "2. Le mot de passe n'est pas correctement URL-encodé" -ForegroundColor White
    Write-Host "3. L'utilisateur n'a pas les permissions sur la base de données" -ForegroundColor White
    Write-Host ""
    Write-Host "Solution: Exécuter scripts/fix-database-authentication.ps1 pour réinitialiser le mot de passe" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ Problèmes détectés:" -ForegroundColor Yellow
    foreach ($rec in $recommendations) {
        Write-Host "  - $rec" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Solution: Exécuter scripts/fix-database-authentication.ps1 pour corriger" -ForegroundColor Cyan
}
Write-Host ""


