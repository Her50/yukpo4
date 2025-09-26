# Script de test automatique - Yukpomnang Mobile
# Usage: .\test-app.ps1

# Configuration
$ErrorActionPreference = "Stop"

# Couleurs pour les messages
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Info { Write-ColorOutput Cyan $args }

# Fonction pour tester la configuration
function Test-Configuration {
    Write-Info "🔧 Test de la configuration..."
    
    $tests = @(
        @{ Name = "Fichier .env"; Path = ".env"; Required = $true },
        @{ Name = "Fichier app.json"; Path = "app.json"; Required = $true },
        @{ Name = "Fichier package.json"; Path = "package.json"; Required = $true },
        @{ Name = "Dossier src"; Path = "src"; Required = $true },
        @{ Name = "Fichier App.tsx"; Path = "App.tsx"; Required = $true }
    )
    
    $allGood = $true
    
    foreach ($test in $tests) {
        if (Test-Path $test.Path) {
            Write-Success "✅ $($test.Name): Trouvé"
        }
        else {
            if ($test.Required) {
                Write-Error "❌ $($test.Name): Manquant (OBLIGATOIRE)"
                $allGood = $false
            }
            else {
                Write-Warning "⚠️ $($test.Name): Manquant (optionnel)"
            }
        }
    }
    
    return $allGood
}

# Fonction pour tester les dépendances
function Test-Dependencies {
    Write-Info "📦 Test des dépendances..."
    
    $tests = @(
        @{ Name = "Node.js"; Command = "node --version"; Required = $true },
        @{ Name = "npm"; Command = "npm --version"; Required = $true },
        @{ Name = "Expo CLI"; Command = "expo --version"; Required = $true }
    )
    
    $allGood = $true
    
    foreach ($test in $tests) {
        try {
            $version = Invoke-Expression $test.Command 2>$null
            if ($version) {
                Write-Success "✅ $($test.Name): $version"
            }
            else {
                throw "Version non trouvée"
            }
        }
        catch {
            if ($test.Required) {
                Write-Error "❌ $($test.Name): Non installé (OBLIGATOIRE)"
                $allGood = $false
            }
            else {
                Write-Warning "⚠️ $($test.Name): Non installé (optionnel)"
            }
        }
    }
    
    return $allGood
}

# Fonction pour tester la connexion
function Test-Connection {
    Write-Info "🌐 Test de la connexion..."
    
    $tests = @(
        @{ Name = "Expo"; Command = "expo whoami"; Required = $true },
        @{ Name = "Internet"; URL = "https://google.com"; Required = $true },
        @{ Name = "API Backend"; URL = "https://yukpomnang.onrender.com"; Required = $false }
    )
    
    $allGood = $true
    
    foreach ($test in $tests) {
        try {
            if ($test.Command) {
                $result = Invoke-Expression $test.Command 2>$null
                if ($result) {
                    Write-Success "✅ $($test.Name): Connecté ($result)"
                }
                else {
                    throw "Non connecté"
                }
            }
            elseif ($test.URL) {
                $response = Invoke-WebRequest -Uri $test.URL -TimeoutSec 10 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Success "✅ $($test.Name): Accessible"
                }
                else {
                    throw "Non accessible"
                }
            }
        }
        catch {
            if ($test.Required) {
                Write-Error "❌ $($test.Name): Non accessible (OBLIGATOIRE)"
                $allGood = $false
            }
            else {
                Write-Warning "⚠️ $($test.Name): Non accessible (optionnel)"
            }
        }
    }
    
    return $allGood
}

# Fonction pour tester le code
function Test-Code {
    Write-Info "💻 Test du code..."
    
    $tests = @(
        @{ Name = "TypeScript"; Command = "npx tsc --noEmit"; Required = $true },
        @{ Name = "ESLint"; Command = "npx eslint src/ --ext .ts,.tsx"; Required = $false }
    )
    
    $allGood = $true
    
    foreach ($test in $tests) {
        try {
            Write-Info "Exécution: $($test.Name)..."
            Invoke-Expression $test.Command 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✅ $($test.Name): Aucune erreur"
            }
            else {
                throw "Erreurs détectées"
            }
        }
        catch {
            if ($test.Required) {
                Write-Error "❌ $($test.Name): Erreurs détectées (OBLIGATOIRE)"
                $allGood = $false
            }
            else {
                Write-Warning "⚠️ $($test.Name): Erreurs détectées (optionnel)"
            }
        }
    }
    
    return $allGood
}

# Fonction pour tester l'application
function Test-Application {
    Write-Info "📱 Test de l'application..."
    
    try {
        Write-Info "Démarrage de l'application en mode test..."
        
        # Démarrer l'application en arrière-plan
        $process = Start-Process -FilePath "npx" -ArgumentList "expo", "start", "--no-dev", "--minify" -NoNewWindow -PassThru
        
        # Attendre un peu pour que l'application démarre
        Start-Sleep -Seconds 10
        
        # Vérifier si le processus est toujours en cours
        if (-not $process.HasExited) {
            Write-Success "✅ Application: Démarrage réussi"
            
            # Arrêter le processus
            $process.Kill()
            $process.WaitForExit()
            
            return $true
        }
        else {
            Write-Error "❌ Application: Échec du démarrage"
            return $false
        }
    }
    catch {
        Write-Error "❌ Application: Erreur lors du test: $_"
        return $false
    }
}

# Fonction pour afficher le résumé
function Show-Summary($results) {
    Write-Info "📊 Résumé des tests"
    Write-Info "=================="
    Write-Info ""
    
    $totalTests = $results.Count
    $passedTests = ($results | Where-Object { $_ -eq $true }).Count
    $failedTests = $totalTests - $passedTests
    
    Write-Info "Total des tests: $totalTests"
    Write-Success "Tests réussis: $passedTests"
    if ($failedTests -gt 0) {
        Write-Error "Tests échoués: $failedTests"
    }
    
    Write-Info ""
    
    if ($failedTests -eq 0) {
        Write-Success "🎉 Tous les tests sont passés !"
        Write-Info "L'application est prête pour le déploiement."
    }
    else {
        Write-Warning "⚠️ Certains tests ont échoué."
        Write-Info "Corrigez les problèmes avant de déployer."
    }
    
    Write-Info ""
    Write-Info "Prochaines étapes:"
    Write-Info "1. Corriger les problèmes identifiés"
    Write-Info "2. Relancer les tests"
    Write-Info "3. Déployer l'application"
}

# Fonction principale
function Main {
    Write-Info "🧪 Test Automatique - Yukpomnang Mobile"
    Write-Info "======================================="
    Write-Info ""
    
    $results = @()
    
    # Test de la configuration
    $configResult = Test-Configuration
    $results += $configResult
    
    # Test des dépendances
    $depsResult = Test-Dependencies
    $results += $depsResult
    
    # Test de la connexion
    $connResult = Test-Connection
    $results += $connResult
    
    # Test du code
    $codeResult = Test-Code
    $results += $codeResult
    
    # Test de l'application
    $appResult = Test-Application
    $results += $appResult
    
    # Afficher le résumé
    Show-Summary $results
}

# Exécution
try {
    Main
}
catch {
    Write-Error "❌ Erreur fatale: $_"
    exit 1
}

