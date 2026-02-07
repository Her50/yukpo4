# Script PowerShell pour tester la configuration réseau Gradle
# Utilisez ce script pour vérifier que les timeouts et retries sont correctement configurés

Write-Host "=== Test de configuration réseau Gradle ===" -ForegroundColor Cyan

# Vérifier les propriétés Gradle
Write-Host "`nVérification des propriétés réseau dans gradle.properties..." -ForegroundColor Yellow
$gradleProps = Get-Content "gradle.properties" | Select-String -Pattern "timeout|retry|network"
if ($gradleProps) {
    Write-Host "Propriétés réseau trouvées:" -ForegroundColor Green
    $gradleProps | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Aucune propriété réseau trouvée" -ForegroundColor Red
}

# Vérifier le wrapper Gradle
Write-Host "`nVérification du timeout dans gradle-wrapper.properties..." -ForegroundColor Yellow
$wrapperProps = Get-Content "gradle\wrapper\gradle-wrapper.properties" | Select-String -Pattern "networkTimeout"
if ($wrapperProps) {
    Write-Host "Timeout réseau configuré:" -ForegroundColor Green
    $wrapperProps | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Timeout réseau non configuré" -ForegroundColor Red
}

# Test de connexion aux repositories Maven
Write-Host "`nTest de connexion aux repositories Maven..." -ForegroundColor Yellow
$repos = @(
    "https://dl.google.com/dl/android/maven2/",
    "https://repo1.maven.org/maven2/",
    "https://www.jitpack.io"
)

foreach ($repo in $repos) {
    try {
        $response = Invoke-WebRequest -Uri $repo -Method Head -TimeoutSec 10 -UseBasicParsing
        Write-Host "  ✓ $repo - OK (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $repo - ÉCHEC: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test terminé ===" -ForegroundColor Cyan

