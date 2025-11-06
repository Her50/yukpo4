# Script pour suivre la progression du build Android en temps réel

$logFile = "build-log.txt"
$apkPath = "mobile\android\app\build\outputs\apk\debug\app-debug.apk"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   SUIVI BUILD ANDROID - YUKPOMNANG" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Appuyez sur Ctrl+C pour arreter le suivi`n" -ForegroundColor Yellow

$lastSize = 0
$startTime = Get-Date

while ($true) {
    Clear-Host
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   BUILD EN COURS - YUKPOMNANG" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    $elapsed = (Get-Date) - $startTime
    Write-Host "Temps ecoule: $($elapsed.ToString('mm\:ss'))" -ForegroundColor Gray
    Write-Host ""
    
    # Vérifier si l'APK est généré
    if (Test-Path $apkPath) {
        $apk = Get-Item $apkPath
        Write-Host "================================" -ForegroundColor Green
        Write-Host "   BUILD TERMINE AVEC SUCCES !" -ForegroundColor Green
        Write-Host "================================`n" -ForegroundColor Green
        Write-Host "APK genere:" -ForegroundColor White
        Write-Host "  Fichier: $apkPath" -ForegroundColor Gray
        Write-Host "  Taille: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "  Date: $($apk.LastWriteTime)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Temps total: $($elapsed.ToString('mm\:ss'))" -ForegroundColor Cyan
        break
    }
    
    # Afficher les dernières lignes du log
    if (Test-Path $logFile) {
        $content = Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
        
        if ($content) {
            Write-Host "Dernieres actions:" -ForegroundColor Yellow
            Write-Host "─────────────────────────────────────" -ForegroundColor Gray
            
            foreach ($line in $content) {
                if ($line -match "BUILD SUCCESSFUL") {
                    Write-Host $line -ForegroundColor Green
                }
                elseif ($line -match "BUILD FAILED") {
                    Write-Host $line -ForegroundColor Red
                }
                elseif ($line -match "> Task") {
                    Write-Host $line -ForegroundColor Cyan
                }
                elseif ($line -match "Download") {
                    Write-Host $line -ForegroundColor Yellow
                }
                elseif ($line -match "FAILURE|ERROR|error") {
                    Write-Host $line -ForegroundColor Red
                }
                else {
                    Write-Host $line -ForegroundColor Gray
                }
            }
        }
        else {
            Write-Host "En attente du demarrage..." -ForegroundColor Yellow
        }
        
        # Détecter si le build a échoué
        $failLines = Select-String -Path $logFile -Pattern "BUILD FAILED" -ErrorAction SilentlyContinue
        if ($failLines) {
            Write-Host "`n================================" -ForegroundColor Red
            Write-Host "   BUILD ECHOUE !" -ForegroundColor Red
            Write-Host "================================`n" -ForegroundColor Red
            Write-Host "Consultez le fichier $logFile pour les details" -ForegroundColor Yellow
            break
        }
    }
    else {
        Write-Host "En attente du demarrage du build..." -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds 3
}

Write-Host "`nAppuyez sur une touche pour quitter..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

