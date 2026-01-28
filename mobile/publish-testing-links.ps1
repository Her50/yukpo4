<# 
  Publication "testing links" (Play + TestFlight)
  Objectif: ne plus envoyer d'APK, mais publier sur des canaux de test officiels.

  Usage (PowerShell):
    cd mobile
    powershell -ExecutionPolicy Bypass -File .\publish-testing-links.ps1

  Prérequis:
  - Expo/EAS connecté (eas login) sur le compte owner du projet
  - Play Console: application créée + package com.yukpomnang.mobile
  - App Store Connect: application créée + bundle id com.yukpomnang.mobile
#>

$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }

if (-not (Test-Path "package.json")) {
  Fail "package.json non trouvé. Lance ce script depuis le dossier mobile/."
  exit 1
}

Info "1) Vérification rapide EAS (optionnel mais recommandé)"
try {
  powershell -ExecutionPolicy Bypass -File .\verif-eas.ps1 | Out-Host
  Ok "Vérification terminée"
} catch {
  Warn "La vérification a signalé des problèmes. Tu peux continuer, mais un build peut échouer."
}

Info "2) Vérifier EAS CLI / connexion"
try {
  $null = eas --version
} catch {
  Warn "EAS CLI non trouvé. Installation..."
  npm install -g eas-cli
}

$who = ""
try { $who = (eas whoami 2>&1) } catch { $who = "" }
if (-not $who -or $who -match "Not logged in") {
  Warn "Tu n'es pas connecté à EAS. Lance: eas login"
  Warn "J'ouvre la page de login Expo."
  Start-Process "https://expo.dev/login" | Out-Null
  exit 1
}
Ok "Connecté à EAS en tant que: $who"

Info "3) Installer dépendances si besoin"
if (-not (Test-Path "node_modules")) {
  Info "node_modules absent → npm install"
  npm install
  Ok "Dépendances installées"
} else {
  Ok "node_modules présent"
}

Info "4) ANDROID (Google Play) : build AAB + submit sur la piste 'internal'"
Info "Lancement build cloud (AAB)..."
npx eas build --platform android --profile production
Ok "Build Android lancé/terminé (selon mode interactif)."

Info "Soumission Play (nécessite mobile/google-service-account.json pour automatiser)"
try {
  npx eas submit --platform android --profile production
  Ok "Submit Android terminé"
} catch {
  Warn "Submit Android n'a pas pu se faire automatiquement (auth/config)."
  Warn "Tu peux uploader manuellement le .aab dans Play Console (Internal/Closed/Open testing)."
}

Info "5) iOS (TestFlight) : build + submit"
Info "Lancement build cloud iOS..."
npx eas build --platform ios --profile production
Ok "Build iOS lancé/terminé (selon mode interactif)."

Info "Soumission TestFlight (App Store Connect)"
try {
  npx eas submit --platform ios --profile production
  Ok "Submit iOS terminé"
} catch {
  Warn "Submit iOS peut demander une authentification Apple/clé API."
  Warn "Relance la commande ou complète dans App Store Connect."
}

Info "6) Récupérer les LIENS PARTAGEABLES (à communiquer aux testeurs)"
Write-Host ""
Write-Host "ANDROID (Play):" -ForegroundColor White
Write-Host "  - Si tu veux un lien partageable, utilise plutôt 'Closed testing' ou 'Open testing'." -ForegroundColor White
Write-Host "  - Play Console → Testing → (Closed testing / Open testing) → Opt-in link (lien d'inscription)." -ForegroundColor White
Write-Host ""
Write-Host "iOS (TestFlight):" -ForegroundColor White
Write-Host "  - App Store Connect → TestFlight → Testers → Public Links → Create link." -ForegroundColor White
Write-Host "  - (External testers) peut nécessiter une Beta App Review la 1ère fois." -ForegroundColor White
Write-Host ""

Info "J'ouvre les pages de connexion"
Start-Process "https://play.google.com/console/" | Out-Null
Start-Process "https://appstoreconnect.apple.com/" | Out-Null
Start-Process "https://developer.apple.com/account/" | Out-Null

Ok "Terminé. Quand tu as copié les 2 liens (Play opt-in + TestFlight public link), tu peux les partager."


