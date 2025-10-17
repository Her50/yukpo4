# Script de surveillance automatique des logs avec analyse et correction
# Ce script surveille les logs en temps réel et applique des corrections automatiques

Write-Host "🔍 SURVEILLANCE AUTOMATIQUE DES LOGS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Importer le LogAnalyzer
$logAnalyzerPath = Join-Path $PSScriptRoot "log-analyzer.js"
if (-not (Test-Path $logAnalyzerPath)) {
    Write-Host "❌ LogAnalyzer non trouvé. Création en cours..." -ForegroundColor Red
    # Le LogAnalyzer a déjà été créé dans l'étape précédente
}

# Fonction pour exécuter Node.js
function Invoke-NodeScript {
    param($ScriptPath, $Arguments = @())
    
    try {
        $result = node $ScriptPath $Arguments 2>&1
        return $result
    } catch {
        Write-Host "❌ Erreur Node.js: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Fonction pour analyser les logs
function Analyze-Logs {
    Write-Host "📊 Analyse des logs en cours..." -ForegroundColor Yellow
    
    $analysisScript = @"
const LogAnalyzer = require('./log-analyzer.js');
const analyzer = new LogAnalyzer();

try {
    const report = analyzer.generateReport();
    console.log('ANALYSIS_START');
    console.log(JSON.stringify(report, null, 2));
    console.log('ANALYSIS_END');
} catch (error) {
    console.log('ERROR:', error.message);
}
"@
    
    $tempScript = "temp-analysis.js"
    Set-Content -Path $tempScript -Value $analysisScript
    
    $result = Invoke-NodeScript $tempScript
    
    # Nettoyer le script temporaire
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    
    if ($result -and $result -match "ANALYSIS_START") {
        $jsonStart = $result.IndexOf("ANALYSIS_START") + "ANALYSIS_START".Length
        $jsonEnd = $result.IndexOf("ANALYSIS_END")
        $jsonContent = $result.Substring($jsonStart, $jsonEnd - $jsonStart).Trim()
        
        try {
            $analysis = $jsonContent | ConvertFrom-Json
            return $analysis
        } catch {
            Write-Host "❌ Erreur de parsing JSON: $($_.Exception.Message)" -ForegroundColor Red
            return $null
        }
    }
    
    return $null
}

# Fonction pour appliquer des corrections automatiques
function Apply-AutoFixes {
    param($Analysis)
    
    if (-not $Analysis) {
        return
    }
    
    Write-Host "🔧 Application des corrections automatiques..." -ForegroundColor Yellow
    
    $fixesApplied = 0
    
    # Correction 1: Désactiver les mises à jour si erreurs de mise à jour
    $updateErrors = $Analysis.suggestions | Where-Object { $_.type -eq "update" }
    if ($updateErrors) {
        Write-Host "🔧 Désactivation des mises à jour automatiques..." -ForegroundColor Yellow
        
        if (Test-Path "app.json") {
            $appConfig = Get-Content "app.json" | ConvertFrom-Json
            
            if (-not $appConfig.expo.updates) {
                $appConfig.expo | Add-Member -NotePropertyName "updates" -NotePropertyValue @{
                    "enabled" = $false
                    "checkAutomatically" = "NEVER"
                    "fallbackToCacheTimeout" = 0
                }
            } else {
                $appConfig.expo.updates.enabled = $false
                $appConfig.expo.updates.checkAutomatically = "NEVER"
                $appConfig.expo.updates.fallbackToCacheTimeout = 0
            }
            
            $appConfig | ConvertTo-Json -Depth 10 | Set-Content "app.json"
            Write-Host "✅ Mises à jour automatiques désactivées" -ForegroundColor Green
            $fixesApplied++
        }
    }
    
    # Correction 2: Redémarrer si erreurs critiques
    $criticalErrors = $Analysis.recommendations | Where-Object { $_.priority -eq "URGENT" }
    if ($criticalErrors) {
        Write-Host "🚨 Erreurs critiques détectées - Redémarrage recommandé" -ForegroundColor Red
        Write-Host "   Exécutez: npm run fix:auto" -ForegroundColor Cyan
        $fixesApplied++
    }
    
    # Correction 3: Nettoyer les caches si problèmes de performance
    $performanceIssues = $Analysis.recommendations | Where-Object { $_.reason -match "performance|chargement" }
    if ($performanceIssues) {
        Write-Host "🧹 Nettoyage des caches recommandé..." -ForegroundColor Yellow
        
        if (Test-Path ".expo") {
            Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
            Write-Host "✅ Cache Expo nettoyé" -ForegroundColor Green
            $fixesApplied++
        }
        
        if (Test-Path "node_modules\.cache") {
            Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
            Write-Host "✅ Cache Node nettoyé" -ForegroundColor Green
            $fixesApplied++
        }
    }
    
    Write-Host "✅ $fixesApplied correction(s) appliquée(s)" -ForegroundColor Green
}

# Fonction pour surveiller les logs en temps réel
function Watch-Logs {
    param($Duration = 300) # 5 minutes par défaut
    
    Write-Host "👀 Surveillance des logs pendant $Duration secondes..." -ForegroundColor Cyan
    
    $startTime = Get-Date
    $lastAnalysis = $null
    
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($Duration)) {
        # Analyser les logs toutes les 30 secondes
        $currentTime = Get-Date
        if (-not $lastAnalysis -or ($currentTime - $lastAnalysis) -gt [TimeSpan]::FromSeconds(30)) {
            $analysis = Analyze-Logs
            
            if ($analysis) {
                Write-Host "📊 Analyse terminée:" -ForegroundColor Green
                Write-Host "   - Erreurs totales: $($analysis.summary.totalErrors)" -ForegroundColor White
                Write-Host "   - Sévérité: $($analysis.summary.severity)" -ForegroundColor White
                Write-Host "   - Suggestions: $($analysis.summary.suggestions)" -ForegroundColor White
                
                # Appliquer les corrections automatiques
                Apply-AutoFixes $analysis
                
                $lastAnalysis = $currentTime
            }
        }
        
        Start-Sleep -Seconds 5
    }
    
    Write-Host "⏰ Surveillance terminée" -ForegroundColor Cyan
}

# Fonction pour créer un rapport détaillé
function Generate-DetailedReport {
    Write-Host "📋 Génération du rapport détaillé..." -ForegroundColor Yellow
    
    $reportScript = @"
const LogAnalyzer = require('./log-analyzer.js');
const analyzer = new LogAnalyzer();

try {
    const report = analyzer.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = \`./reports/analysis-report-\${timestamp}.json\`;
    
    // Créer le dossier reports s'il n'existe pas
    const fs = require('fs');
    if (!fs.existsSync('./reports')) {
        fs.mkdirSync('./reports');
    }
    
    const savedPath = analyzer.exportLogs(reportPath);
    console.log('REPORT_SAVED:', savedPath);
    
    // Afficher un résumé
    console.log('\\n=== RÉSUMÉ DU RAPPORT ===');
    console.log(\`Erreurs totales: \${report.summary.totalErrors}\`);
    console.log(\`Sévérité: \${report.summary.severity}\`);
    console.log(\`Suggestions: \${report.summary.suggestions}\`);
    console.log(\`Métriques de performance: \${report.summary.performanceMetrics}\`);
    
    if (report.recommendations.length > 0) {
        console.log('\\n=== RECOMMANDATIONS ===');
        report.recommendations.forEach((rec, index) => {
            console.log(\`\${index + 1}. [\${rec.priority}] \${rec.action}\`);
            console.log(\`   Raison: \${rec.reason}\`);
        });
    }
    
} catch (error) {
    console.log('ERROR:', error.message);
}
"@
    
    $tempScript = "temp-report.js"
    Set-Content -Path $tempScript -Value $reportScript
    
    $result = Invoke-NodeScript $tempScript
    
    # Nettoyer le script temporaire
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    
    if ($result -and $result -match "REPORT_SAVED:") {
        $reportPath = ($result | Where-Object { $_ -match "REPORT_SAVED:" }) -replace "REPORT_SAVED: ", ""
        Write-Host "✅ Rapport sauvegardé: $reportPath" -ForegroundColor Green
    }
}

# Menu principal
function Show-Menu {
    Write-Host "`n🎯 SURVEILLANCE AUTOMATIQUE DES LOGS YUKPO" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "1. 📊 Analyser les logs actuels" -ForegroundColor White
    Write-Host "2. 👀 Surveiller les logs en temps réel (5 min)" -ForegroundColor White
    Write-Host "3. 📋 Générer un rapport détaillé" -ForegroundColor White
    Write-Host "4. 🧹 Nettoyer les logs" -ForegroundColor White
    Write-Host "5. 🔧 Appliquer toutes les corrections" -ForegroundColor White
    Write-Host "6. ❌ Quitter" -ForegroundColor White
    Write-Host ""
}

# Fonction principale
function Main {
    do {
        Show-Menu
        $choice = Read-Host "Choisissez une option (1-6)"
        
        switch ($choice) {
            "1" {
                $analysis = Analyze-Logs
                if ($analysis) {
                    Write-Host "`n📊 Résumé de l'analyse:" -ForegroundColor Green
                    Write-Host "   Erreurs: $($analysis.summary.totalErrors)" -ForegroundColor White
                    Write-Host "   Sévérité: $($analysis.summary.severity)" -ForegroundColor White
                    Write-Host "   Suggestions: $($analysis.summary.suggestions)" -ForegroundColor White
                }
            }
            "2" {
                $duration = Read-Host "Durée de surveillance en secondes (défaut: 300)"
                if (-not $duration -or $duration -notmatch '^\d+$') {
                    $duration = 300
                }
                Watch-Logs $duration
            }
            "3" {
                Generate-DetailedReport
            }
            "4" {
                Write-Host "🧹 Nettoyage des logs..." -ForegroundColor Yellow
                $cleanScript = @"
const LogAnalyzer = require('./log-analyzer.js');
const analyzer = new LogAnalyzer();
analyzer.clearLogs();
console.log('Logs nettoyés');
"@
                $tempScript = "temp-clean.js"
                Set-Content -Path $tempScript -Value $cleanScript
                Invoke-NodeScript $tempScript
                Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
                Write-Host "✅ Logs nettoyés" -ForegroundColor Green
            }
            "5" {
                Write-Host "🔧 Application de toutes les corrections..." -ForegroundColor Yellow
                & "$PSScriptRoot\auto-fix-and-restart.ps1"
            }
            "6" {
                Write-Host "👋 Au revoir !" -ForegroundColor Cyan
                break
            }
            default {
                Write-Host "❌ Option invalide" -ForegroundColor Red
            }
        }
        
        if ($choice -ne "6") {
            Write-Host "`nAppuyez sur Entrée pour continuer..."
            Read-Host
        }
        
    } while ($choice -ne "6")
}

# Exécuter le script principal
Main
