# Script pour vérifier la progression du build Android

Write-Host "`n=== VERIFICATION DU BUILD ANDROID ===" -ForegroundColor Cyan
Write-Host ""

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$buildDir = "android\app\build"

if (Test-Path $apkPath) {
    $apk = Get-Item $apkPath
    Write-Host "APK GENERE !" -ForegroundColor Green
    Write-Host "  Fichier: $apkPath" -ForegroundColor White
    Write-Host "  Taille: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "  Date: $($apk.LastWriteTime)" -ForegroundColor White
    Write-Host ""
    Write-Host "BUILD TERMINE AVEC SUCCES !" -ForegroundColor Green
}
elseif (Test-Path $buildDir) {
    Write-Host "COMPILATION EN COURS..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fichiers recents du build:" -ForegroundColor Gray
    Get-ChildItem -Path $buildDir -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
        Write-Host "  $($_.LastWriteTime.ToString('HH:mm:ss')) - $($_.Name)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "La compilation continue... Patience !" -ForegroundColor Yellow
}
else {
    Write-Host "Build pas encore demarre ou nettoye" -ForegroundColor Gray
}

Write-Host ""

