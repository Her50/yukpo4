# Script pour vérifier les messages de migration dans les logs
# Usage: .\backend\scripts\check_migration_logs.ps1 [chemin_vers_logs.txt]

param(
    [string]$LogFile = ""
)

Write-Host "🔍 ========== VÉRIFICATION DES LOGS DE MIGRATION ==========" -ForegroundColor Cyan
Write-Host ""

# Messages clés à rechercher (dans l'ordre d'exécution attendu)
$migrationSteps = @(
    @{ Pattern = "🚀 Application des migrations SQLx standard"; Name = "1. Démarrage migrations SQLx"; Critical = $true },
    @{ Pattern = "📁 Dossier migrations trouvé"; Name = "2. Dossier migrations trouvé"; Critical = $false },
    @{ Pattern = "📊 Migrations déjà appliquées"; Name = "3. État migrations précédentes"; Critical = $false },
    @{ Pattern = "🔄 \[MIGRATION 0\] Application de la migration 0"; Name = "4. Application migration 0"; Critical = $true },
    @{ Pattern = "✅ \[MIGRATION 0\] Migration 0 appliquée avec succès"; Name = "5. Migration 0 réussie"; Critical = $true },
    @{ Pattern = "🔄 \[MIGRATION CONSOLIDÉE\] Application FORCÉE"; Name = "6. Application migration consolidée"; Critical = $true },
    @{ Pattern = "✅ \[MIGRATION CONSOLIDÉE\] Migration consolidée appliquée avec succès"; Name = "7. Migration consolidée réussie"; Critical = $true },
    @{ Pattern = "🔄 \[MIGRATIONS SQLX\] Application des migrations SQLx standard"; Name = "8. Application migrations SQLx"; Critical = $true },
    @{ Pattern = "✅ Migrations SQLx standard appliquées avec succès"; Name = "9. Migrations SQLx réussies"; Critical = $true },
    @{ Pattern = "✅ Tables de base \(users, services\) vérifiées"; Name = "10. Tables de base vérifiées"; Critical = $true },
    @{ Pattern = "✅ Toutes les tables critiques existent"; Name = "11. Toutes tables critiques OK"; Critical = $true },
    @{ Pattern = "✅ Table product_creation_queue"; Name = "12. Table product_creation_queue OK"; Critical = $false },
    @{ Pattern = "✅ Table cache_table"; Name = "13. Table cache_table OK"; Critical = $false }
)

# Messages d'erreur à rechercher
$errorPatterns = @(
    @{ Pattern = "❌.*MIGRATION.*Erreur"; Name = "Erreur migration" },
    @{ Pattern = "❌.*ERREUR CRITIQUE.*tables"; Name = "Erreur tables critiques" },
    @{ Pattern = "❌.*Migration consolidée.*Erreur"; Name = "Erreur migration consolidée" }
)

if ($LogFile -and (Test-Path $LogFile)) {
    Write-Host "📄 Lecture du fichier de logs: $LogFile" -ForegroundColor Yellow
    $logs = Get-Content $LogFile -Raw
} else {
    Write-Host "⚠️  Aucun fichier de logs fourni ou fichier introuvable" -ForegroundColor Yellow
    Write-Host "💡 Pour utiliser ce script avec un fichier de logs:" -ForegroundColor Cyan
    Write-Host "   .\backend\scripts\check_migration_logs.ps1 -LogFile 'chemin\vers\logs.txt'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Messages de migration attendus dans les logs de démarrage:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($step in $migrationSteps) {
        $status = if ($step.Critical) { "🔴 CRITIQUE" } else { "🟡 Info" }
        Write-Host "   $status $($step.Name)" -ForegroundColor $(if ($step.Critical) { "Red" } else { "Yellow" })
        Write-Host "      Pattern: $($step.Pattern)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "💡 Pour vérifier les logs AWS/CloudWatch:" -ForegroundColor Cyan
    Write-Host "   1. Allez dans AWS Console > CloudWatch > Log Groups" -ForegroundColor Gray
    Write-Host "   2. Trouvez le log group de votre application" -ForegroundColor Gray
    Write-Host "   3. Recherchez les messages ci-dessus dans les logs de démarrage" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Pour vérifier les logs locaux:" -ForegroundColor Cyan
    Write-Host "   cargo run 2>&1 | Tee-Object -FilePath logs.txt" -ForegroundColor Gray
    Write-Host "   .\backend\scripts\check_migration_logs.ps1 -LogFile logs.txt" -ForegroundColor Gray
    
    exit 0
}

Write-Host ""
Write-Host "📊 Analyse des logs..." -ForegroundColor Yellow
Write-Host ""

$foundSteps = @()
$missingCritical = @()

foreach ($step in $migrationSteps) {
    if ($logs -match $step.Pattern) {
        $foundSteps += $step
        $icon = if ($step.Critical) { "✅" } else { "ℹ️" }
        Write-Host "$icon $($step.Name)" -ForegroundColor Green
    } else {
        if ($step.Critical) {
            $missingCritical += $step
            Write-Host "❌ $($step.Name) - MANQUANT" -ForegroundColor Red
        } else {
            Write-Host "⚠️  $($step.Name) - Non trouvé (non critique)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "🔍 Recherche d'erreurs..." -ForegroundColor Yellow

$errorsFound = $false
foreach ($errorPattern in $errorPatterns) {
    if ($logs -match $errorPattern.Pattern) {
        $errorsFound = $true
        Write-Host "❌ $($errorPattern.Name) détecté" -ForegroundColor Red
        # Afficher les lignes d'erreur
        $matches = [regex]::Matches($logs, $errorPattern.Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        foreach ($match in $matches) {
            $line = $match.Value
            if ($line.Length -gt 150) { $line = $line.Substring(0, 150) + "..." }
            Write-Host "   $line" -ForegroundColor DarkRed
        }
    }
}

if (-not $errorsFound) {
    Write-Host "✅ Aucune erreur critique détectée" -ForegroundColor Green
}

Write-Host ""
Write-Host "📈 Résumé:" -ForegroundColor Cyan
Write-Host "   Étapes trouvées: $($foundSteps.Count)/$($migrationSteps.Count)" -ForegroundColor $(if ($foundSteps.Count -eq $migrationSteps.Count) { "Green" } else { "Yellow" })
Write-Host "   Étapes critiques manquantes: $($missingCritical.Count)" -ForegroundColor $(if ($missingCritical.Count -eq 0) { "Green" } else { "Red" })

if ($missingCritical.Count -eq 0 -and $foundSteps.Count -ge 8) {
    Write-Host ""
    Write-Host "✅ CONCLUSION: Les migrations semblent avoir été exécutées avec succès !" -ForegroundColor Green
} elseif ($missingCritical.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  CONCLUSION: Certaines étapes critiques sont manquantes dans les logs" -ForegroundColor Yellow
    Write-Host "   Vérifiez les logs de démarrage complets pour plus de détails" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "⚠️  CONCLUSION: Analyse incomplète - vérifiez les logs de démarrage complets" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Cyan

