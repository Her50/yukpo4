# Script pour servir l'APK via serveur HTTP avec QR code
# Necessite: npm install -g qrcode-terminal http-server

param(
    [string]$ApkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SERVEUR APK avec QR CODE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que l'APK existe
if (-not (Test-Path $ApkPath)) {
    Write-Host "[ERREUR] APK non trouve : $ApkPath" -ForegroundColor Red
    Write-Host "Compilez d'abord avec BUILD-APK.bat" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "[OK] APK trouve : $ApkPath" -ForegroundColor Green
$apkSize = [math]::Round((Get-Item $ApkPath).Length / 1MB, 2)
Write-Host "[INFO] Taille : $apkSize MB" -ForegroundColor Cyan
Write-Host ""

# Obtenir l'adresse IP locale
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress

if (-not $localIP) {
    $localIP = "localhost"
    Write-Host "[ATTENTION] IP locale non trouvee, utilisation de localhost" -ForegroundColor Yellow
}

$port = 8080
$url = "http://${localIP}:${port}/app-debug.apk"

Write-Host "[INFO] Adresse IP locale : $localIP" -ForegroundColor Cyan
Write-Host "[INFO] URL de telechargement : $url" -ForegroundColor Cyan
Write-Host ""

# Copier l'APK dans un dossier temporaire pour le servir
$tempDir = ".\temp-apk-server"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Copy-Item $ApkPath -Destination "$tempDir\app-debug.apk" -Force

Write-Host "========================================" -ForegroundColor Green
Write-Host "   SERVEUR DEMARRE !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Assurez-vous que votre telephone est sur le MEME WIFI" -ForegroundColor Yellow
Write-Host "2. Scannez le QR code ci-dessous avec votre telephone" -ForegroundColor Yellow
Write-Host "3. Telechargez et installez l'APK" -ForegroundColor Yellow
Write-Host ""

# Generer le QR code avec Node.js
$qrScript = @"
const qrcode = require('qrcode-terminal');
qrcode.generate('$url', {small: true}, function (qr) {
    console.log(qr);
});
"@

$qrScript | Set-Content -Path "$tempDir\qr.js"

Write-Host "QR CODE:" -ForegroundColor Cyan
Write-Host ""

try {
    node "$tempDir\qr.js"
}
catch {
    Write-Host "[INFO] qrcode-terminal non installe" -ForegroundColor Yellow
    Write-Host "Installation en cours..." -ForegroundColor Cyan
    npm install -g qrcode-terminal 2>&1 | Out-Null
    node "$tempDir\qr.js"
}

Write-Host ""
Write-Host "OU ouvrez cette URL dans votre navigateur mobile :" -ForegroundColor Cyan
Write-Host "$url" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arreter le serveur" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Demarrer le serveur HTTP
try {
    npx --yes http-server $tempDir -p $port --cors
}
finally {
    # Nettoyage
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

