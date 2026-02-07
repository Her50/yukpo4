# Script pour lancer le build production avec EAS
# Usage: .\build-production-eas.ps1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG - BUILD PRODUCTION EAS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier la connexion EAS
Write-Host "Vérification de la connexion EAS..." -ForegroundColor Cyan
$whoami = eas whoami 2>&1
if ($whoami -match "Not logged in") {
    Write-Host "  X Non connecte a EAS" -ForegroundColor Red
    Write-Host ""
    Write-Host "Etape 1 : Connexion a EAS" -ForegroundColor Yellow
    Write-Host "  Entrez vos identifiants Expo:" -ForegroundColor Gray
    Write-Host "    Email/Username: hernandezlele" -ForegroundColor White
    Write-Host ""
    eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "X Echec de la connexion" -ForegroundColor Red
        Write-Host "Verifiez vos identifiants et reessayez." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  OK Deja connecte: $whoami" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LANCEMENT DU BUILD PRODUCTION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Le build va etre lance avec le profil 'production'." -ForegroundColor Yellow
Write-Host "Cela va generer un APK standalone (autonome) optimise." -ForegroundColor Gray
Write-Host ""
Write-Host "Caracteristiques de l'APK:" -ForegroundColor Cyan
Write-Host "  OK Standalone (aucun serveur requis)" -ForegroundColor Green
Write-Host "  OK Optimise et signe automatiquement" -ForegroundColor Green
Write-Host "  OK Taille: ~30-40 MB" -ForegroundColor Green
Write-Host "  OK Pret pour distribution" -ForegroundColor Green
Write-Host ""
Write-Host "Temps estimé: 15-25 minutes" -ForegroundColor Yellow
Write-Host ""
Write-Host "Lancement du build..." -ForegroundColor Green
Write-Host ""

# Lancer le build
eas build --platform android --profile production

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  BUILD TERMINE AVEC SUCCES !" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Un lien de telechargement de l'APK vous a ete fourni." -ForegroundColor Cyan
    Write-Host "Vous pouvez maintenant partager cet APK avec vos utilisateurs." -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour voir tous vos builds:" -ForegroundColor Yellow
    Write-Host "  eas build:list" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  BUILD ECHOUE" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez les logs ci-dessus pour plus de details." -ForegroundColor Yellow
    exit 1
}

