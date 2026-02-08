# Script pour convertir AAB en APK pour tests locaux
# Nécessite bundletool.jar (téléchargeable depuis https://github.com/google/bundletool/releases)

param(
    [Parameter(Mandatory=$true)]
    [string]$AabPath,
    
    [Parameter(Mandatory=$false)]
    [string]$BundletoolPath = "bundletool.jar",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "app.apks"
)

Write-Host "🔄 Conversion de l'AAB en APK..." -ForegroundColor Cyan

# Vérifier que bundletool existe
if (-not (Test-Path $BundletoolPath)) {
    Write-Host "❌ bundletool.jar non trouvé à: $BundletoolPath" -ForegroundColor Red
    Write-Host "📥 Téléchargez-le depuis: https://github.com/google/bundletool/releases" -ForegroundColor Yellow
    exit 1
}

# Vérifier que l'AAB existe
if (-not (Test-Path $AabPath)) {
    Write-Host "❌ Fichier AAB non trouvé: $AabPath" -ForegroundColor Red
    exit 1
}

# Générer le fichier .apks (archive contenant les APK)
Write-Host "📦 Génération du fichier .apks..." -ForegroundColor Cyan
java -jar $BundletoolPath build-apks --bundle=$AabPath --output=$OutputPath --mode=universal

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Conversion réussie!" -ForegroundColor Green
    Write-Host "📱 Fichier généré: $OutputPath" -ForegroundColor Green
    Write-Host "💡 Pour extraire l'APK, renommez .apks en .zip et extrayez-le" -ForegroundColor Yellow
} else {
    Write-Host "❌ Erreur lors de la conversion" -ForegroundColor Red
    exit 1
}



