# Script PowerShell pour exécuter tous les tests mobile Yukpo
# Usage: .\run-mobile-tests.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$GenerateReport
)

# Couleurs pour les logs
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Magenta = "Magenta"
    Cyan = "Cyan"
    White = "White"
}

function Write-ColorLog {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorLog "🔍 Vérification des prérequis..." -Color $Colors.Blue
    
    # Vérifier Node.js
    try {
        $nodeVersion = node --version
        Write-ColorLog "✅ Node.js: $nodeVersion" -Color $Colors.Green
    } catch {
        Write-ColorLog "❌ Node.js non installé" -Color $Colors.Red
        return $false
    }
    
    # Vérifier npm
    try {
        $npmVersion = npm --version
        Write-ColorLog "✅ npm: $npmVersion" -Color $Colors.Green
    } catch {
        Write-ColorLog "❌ npm non installé" -Color $Colors.Red
        return $false
    }
    
    # Vérifier EAS CLI
    try {
        $easVersion = npx eas --version
        Write-ColorLog "✅ EAS CLI: $easVersion" -Color $Colors.Green
    } catch {
        Write-ColorLog "❌ EAS CLI non installé" -Color $Colors.Red
        return $false
    }
    
    return $true
}

function Start-EASBuild {
    Write-ColorLog "🚀 Lancement du build EAS Android..." -Color $Colors.Magenta
    
    try {
        $buildResult = npx eas build --platform android --profile preview --non-interactive
        if ($LASTEXITCODE -eq 0) {
            Write-ColorLog "✅ Build EAS terminé avec succès" -Color $Colors.Green
            return $true
        } else {
            Write-ColorLog "❌ Échec du build EAS" -Color $Colors.Red
            return $false
        }
    } catch {
        Write-ColorLog "❌ Erreur lors du build EAS: $($_.Exception.Message)" -Color $Colors.Red
        return $false
    }
}

function Start-AuthTests {
    Write-ColorLog "🧪 Lancement des tests d'authentification..." -Color $Colors.Blue
    
    try {
        $testResult = node scripts/test-auth-mobile.js
        if ($LASTEXITCODE -eq 0) {
            Write-ColorLog "✅ Tests d'authentification réussis" -Color $Colors.Green
            return $true
        } else {
            Write-ColorLog "❌ Échec des tests d'authentification" -Color $Colors.Red
            return $false
        }
    } catch {
        Write-ColorLog "❌ Erreur lors des tests d'authentification: $($_.Exception.Message)" -Color $Colors.Red
        return $false
    }
}

function Start-FeatureTests {
    Write-ColorLog "🧪 Lancement des tests de fonctionnalités..." -Color $Colors.Blue
    
    try {
        $testResult = node scripts/test-mobile-features.js
        if ($LASTEXITCODE -eq 0) {
            Write-ColorLog "✅ Tests de fonctionnalités réussis" -Color $Colors.Green
            return $true
        } else {
            Write-ColorLog "❌ Échec des tests de fonctionnalités" -Color $Colors.Red
            return $false
        }
    } catch {
        Write-ColorLog "❌ Erreur lors des tests de fonctionnalités: $($_.Exception.Message)" -Color $Colors.Red
        return $false
    }
}

function Generate-TestReport {
    param(
        [bool]$BuildSuccess,
        [bool]$AuthTestsSuccess,
        [bool]$FeatureTestsSuccess
    )
    
    $reportPath = "scripts/test-report-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').md"
    
    $buildStatus = if ($BuildSuccess) { 'Reussi' } else { 'Echoue' }
    $authStatus = if ($AuthTestsSuccess) { 'Reussi' } else { 'Echoue' }
    $featureStatus = if ($FeatureTestsSuccess) { 'Reussi' } else { 'Echoue' }
    
    $conclusion = if ($BuildSuccess -and $AuthTestsSuccess -and $FeatureTestsSuccess) {
        'TOUS LES TESTS SONT PASSES !' + "`n" + 'L application mobile Yukpo est prete pour les tests utilisateur.'
    } else {
        'CERTAINS TESTS ONT ECHOUE' + "`n" + 'Verifiez les logs pour plus de details.'
    }
    
    $report = @"
# Rapport de Tests Mobile Yukpo
**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Environnement:** Preview

## Resume des Tests

- Build EAS Android: $buildStatus
- Tests d'Authentification: $authStatus  
- Tests de Fonctionnalites: $featureStatus

## Conclusion

$conclusion

## Installation

L'APK est disponible via EAS Build. Consultez les logs du build pour le lien d'installation.

## Prochaines Etapes

1. Installer l'APK sur un appareil Android
2. Tester l'inscription et la connexion
3. Verifier la navigation dans l'application
4. Tester les fonctionnalites principales

---
*Rapport genere automatiquement par run-mobile-tests.ps1*
"@

    $report | Out-File -FilePath $reportPath -Encoding UTF8
    Write-ColorLog "📄 Rapport généré: $reportPath" -Color $Colors.Cyan
    
    return $reportPath
}

# Script principal
function Main {
    Write-ColorLog "🚀 Démarrage des tests mobile Yukpo" -Color $Colors.Magenta
    Write-ColorLog "========================================" -Color $Colors.White
    
    # Vérifier les prérequis
    if (-not (Test-Prerequisites)) {
        Write-ColorLog "❌ Prérequis manquants. Arrêt des tests." -Color $Colors.Red
        exit 1
    }
    
    $buildSuccess = $true
    $authTestsSuccess = $true
    $featureTestsSuccess = $true
    
    # Build EAS (si non ignoré)
    if (-not $SkipBuild) {
        $buildSuccess = Start-EASBuild
    } else {
        Write-ColorLog "⏭️ Build EAS ignoré" -Color $Colors.Yellow
    }
    
    # Tests d'authentification (si non ignorés)
    if (-not $SkipTests) {
        $authTestsSuccess = Start-AuthTests
        $featureTestsSuccess = Start-FeatureTests
    } else {
        Write-ColorLog "⏭️ Tests ignorés" -Color $Colors.Yellow
    }
    
    # Générer le rapport
    if ($GenerateReport) {
        $reportPath = Generate-TestReport -BuildSuccess $buildSuccess -AuthTestsSuccess $authTestsSuccess -FeatureTestsSuccess $featureTestsSuccess
    }
    
    # Résumé final
    Write-ColorLog "========================================" -Color $Colors.White
    Write-ColorLog "📊 Résumé des tests:" -Color $Colors.Cyan
    Write-ColorLog "   - Build EAS: $(if ($buildSuccess) { '✅ Réussi' } else { '❌ Échoué' })" -Color $(if ($buildSuccess) { $Colors.Green } else { $Colors.Red })
    Write-ColorLog "   - Tests Auth: $(if ($authTestsSuccess) { '✅ Réussi' } else { '❌ Échoué' })" -Color $(if ($authTestsSuccess) { $Colors.Green } else { $Colors.Red })
    Write-ColorLog "   - Tests Features: $(if ($featureTestsSuccess) { '✅ Réussi' } else { '❌ Échoué' })" -Color $(if ($featureTestsSuccess) { $Colors.Green } else { $Colors.Red })
    
    if ($buildSuccess -and $authTestsSuccess -and $featureTestsSuccess) {
        Write-ColorLog "🎉 TOUS LES TESTS SONT PASSÉS !" -Color $Colors.Green
        exit 0
    } else {
        Write-ColorLog "❌ CERTAINS TESTS ONT ÉCHOUÉ" -Color $Colors.Red
        exit 1
    }
}

# Gestion des paramètres
if ($args -contains "--help" -or $args -contains "-h") {
    Write-Host @"
Usage: .\run-mobile-tests.ps1 [options]

Options:
  -SkipBuild      Ignorer le build EAS
  -SkipTests      Ignorer les tests automatisés
  -GenerateReport Générer un rapport de tests
  --help, -h      Afficher cette aide

Exemples:
  .\run-mobile-tests.ps1                    # Exécuter tous les tests
  .\run-mobile-tests.ps1 -SkipBuild         # Ignorer le build, exécuter les tests
  .\run-mobile-tests.ps1 -GenerateReport    # Exécuter tous les tests et générer un rapport
"@
    exit 0
}

# Exécuter le script principal
Main
