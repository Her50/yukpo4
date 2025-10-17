# Script pour analyser les crashs de l'application

param(
    [string]$LogFile = "",
    [switch]$Live = $false
)

Write-Host "🔍 ANALYSEUR DE CRASHS YUKPOMNANG" -ForegroundColor Cyan
Write-Host ""

function Analyze-CrashLog {
    param($Content)
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "📊 ANALYSE DES CRASHS" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    
    # Rechercher les erreurs fatales
    $fatalErrors = $Content | Select-String -Pattern "FATAL EXCEPTION|AndroidRuntime.*FATAL" -Context 5,10
    if ($fatalErrors) {
        Write-Host "🔴 ERREURS FATALES DÉTECTÉES:" -ForegroundColor Red
        $fatalErrors | ForEach-Object {
            Write-Host ""
            Write-Host $_.Line -ForegroundColor Red
            $_.Context.PostContext | ForEach-Object { Write-Host $_ -ForegroundColor DarkRed }
        }
        Write-Host ""
    }
    
    # Rechercher les erreurs JavaScript
    $jsErrors = $Content | Select-String -Pattern "ReactNativeJS.*Error|ExceptionsManager" -Context 2,5
    if ($jsErrors) {
        Write-Host "🟡 ERREURS JAVASCRIPT:" -ForegroundColor Yellow
        $jsErrors | ForEach-Object {
            Write-Host ""
            Write-Host $_.Line -ForegroundColor Yellow
            $_.Context.PostContext | ForEach-Object { Write-Host $_ -ForegroundColor DarkYellow }
        }
        Write-Host ""
    }
    
    # Rechercher les erreurs de modules natifs
    $nativeErrors = $Content | Select-String -Pattern "ExpoModules.*error|NativeModule.*error" -Context 2,5
    if ($nativeErrors) {
        Write-Host "🟠 ERREURS DE MODULES NATIFS:" -ForegroundColor Magenta
        $nativeErrors | ForEach-Object {
            Write-Host ""
            Write-Host $_.Line -ForegroundColor Magenta
            $_.Context.PostContext | ForEach-Object { Write-Host $_ -ForegroundColor DarkMagenta }
        }
        Write-Host ""
    }
    
    # Rechercher les erreurs de permissions
    $permErrors = $Content | Select-String -Pattern "Permission denied|SecurityException"
    if ($permErrors) {
        Write-Host "🔐 ERREURS DE PERMISSIONS:" -ForegroundColor Red
        $permErrors | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    # Rechercher les erreurs de mémoire
    $memErrors = $Content | Select-String -Pattern "OutOfMemory|OOM"
    if ($memErrors) {
        Write-Host "💾 ERREURS DE MÉMOIRE:" -ForegroundColor Red
        $memErrors | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    # Statistiques
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "📈 STATISTIQUES:" -ForegroundColor Cyan
    Write-Host "   Erreurs fatales: $($fatalErrors.Count)" -ForegroundColor White
    Write-Host "   Erreurs JavaScript: $($jsErrors.Count)" -ForegroundColor White
    Write-Host "   Erreurs natives: $($nativeErrors.Count)" -ForegroundColor White
    Write-Host "   Erreurs permissions: $($permErrors.Count)" -ForegroundColor White
    Write-Host "   Erreurs mémoire: $($memErrors.Count)" -ForegroundColor White
    Write-Host ""
    
    # Recommandations
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "💡 RECOMMANDATIONS:" -ForegroundColor Green
    
    if ($fatalErrors -or $jsErrors) {
        Write-Host "1. Examinez les stack traces ci-dessus pour identifier le fichier problématique" -ForegroundColor White
        Write-Host "2. Vérifiez les imports et dépendances dans les fichiers mentionnés" -ForegroundColor White
    }
    
    if ($nativeErrors) {
        Write-Host "3. Vérifiez que tous les modules natifs sont correctement installés" -ForegroundColor White
        Write-Host "4. Essayez de rebuilder avec: npx expo prebuild --clean" -ForegroundColor Yellow
    }
    
    if ($permErrors) {
        Write-Host "5. Vérifiez les permissions dans app.json et AndroidManifest.xml" -ForegroundColor White
    }
    
    if ($memErrors) {
        Write-Host "6. L'application consomme trop de mémoire - optimisez les images/données" -ForegroundColor White
    }
    
    Write-Host ""
}

# Mode Live
if ($Live) {
    Write-Host "📡 Mode surveillance en temps réel activé" -ForegroundColor Yellow
    Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Gray
    Write-Host ""
    
    # Vérifier ADB
    $adbPath = Get-Command adb -ErrorAction SilentlyContinue
    if (-not $adbPath) {
        Write-Host "❌ ADB non trouvé" -ForegroundColor Red
        exit 1
    }
    
    # Buffer pour accumulation
    $buffer = @()
    $lastAnalysis = Get-Date
    
    adb logcat -v time | ForEach-Object {
        $buffer += $_
        
        # Analyser toutes les 10 secondes
        if ((Get-Date) - $lastAnalysis -gt [TimeSpan]::FromSeconds(10)) {
            Clear-Host
            Analyze-CrashLog $buffer
            $lastAnalysis = Get-Date
        }
    }
}
# Mode fichier
elseif ($LogFile -ne "") {
    if (-not (Test-Path $LogFile)) {
        Write-Host "❌ Fichier non trouvé: $LogFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "📄 Analyse du fichier: $LogFile" -ForegroundColor Yellow
    Write-Host ""
    
    $content = Get-Content $LogFile
    Analyze-CrashLog $content
}
# Rechercher les logs récents
else {
    $recentLogs = Get-ChildItem -Filter "*logs*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($recentLogs) {
        Write-Host "📄 Fichier de log le plus récent trouvé: $($recentLogs.Name)" -ForegroundColor Yellow
        Write-Host ""
        
        $content = Get-Content $recentLogs.FullName
        Analyze-CrashLog $content
    }
    else {
        Write-Host "❌ Aucun fichier de log trouvé" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Utilisation:" -ForegroundColor Yellow
        Write-Host "   .\crash-analyzer.ps1 -LogFile 'fichier.txt'  # Analyser un fichier" -ForegroundColor White
        Write-Host "   .\crash-analyzer.ps1 -Live                  # Surveillance temps réel" -ForegroundColor White
    }
}

