<# 
  Script interactif étape par étape pour publier en mode testing
  Usage: powershell -ExecutionPolicy Bypass -File .\publish-testing-interactif.ps1
#>

$ErrorActionPreference = "Continue"

function Info($msg) { Write-Host "`n[INFO] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[ERR]  $msg" -ForegroundColor Red }
function Step($num, $msg) { Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta; Write-Host "ÉTAPE $num : $msg" -ForegroundColor Magenta; Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Magenta }
function Pause($msg = "Appuyez sur Entrée pour continuer...") { Write-Host "`n$msg" -ForegroundColor Gray; Read-Host }

Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 PUBLICATION TESTING - GUIDE INTERACTIF            ║
║                                                          ║
║   Objectif: Publier ton app avec des liens partageables ║
║   (Play Store + TestFlight)                             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

if (-not (Test-Path "package.json")) {
  Fail "package.json non trouvé. Lance ce script depuis le dossier mobile/."
  exit 1
}

# Vérification initiale
Step "0" "Vérification des prérequis"

Info "Vérification EAS CLI..."
try {
  $easVersion = eas --version 2>&1
  Ok "EAS CLI installé : $easVersion"
} catch {
  Warn "EAS CLI non trouvé. Installation..."
  npm install -g eas-cli
  if ($LASTEXITCODE -ne 0) {
    Fail "Impossible d'installer EAS CLI. Installe-le manuellement : npm install -g eas-cli"
    exit 1
  }
}

Info "Vérification connexion EAS..."
$who = ""
try { 
  $who = (eas whoami 2>&1 | Out-String).Trim()
} catch { 
  $who = "" 
}

if (-not $who -or $who -match "Not logged in|Error") {
  Warn "Tu n'es pas connecté à EAS."
  Info "Je vais ouvrir la page de login Expo..."
  Start-Process "https://expo.dev/login" | Out-Null
  Pause "Une fois connecté, appuie sur Entrée pour continuer..."
  
  $who = (eas whoami 2>&1 | Out-String).Trim()
  if (-not $who -or $who -match "Not logged in|Error") {
    Fail "Tu n'es toujours pas connecté. Lance manuellement : eas login"
    exit 1
  }
}

Ok "Connecté à EAS en tant que : $who"

Info "Vérification dépendances..."
if (-not (Test-Path "node_modules")) {
  Warn "node_modules absent. Installation..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Fail "Erreur lors de l'installation des dépendances"
    exit 1
  }
  Ok "Dépendances installées"
} else {
  Ok "node_modules présent"
}

Pause "Prérequis OK. Prêt à commencer ?"

# Menu principal
:MAIN_MENU
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                    MENU PRINCIPAL                        ║
╚══════════════════════════════════════════════════════════╝

  1. 📱 ANDROID - Build + Submit (Play Store)
  2. 🍎 iOS - Build + Submit (TestFlight)
  3. 🔗 Obtenir les liens partageables (guide)
  4. 📋 Voir mes builds récents
  5. 📚 Ouvrir le guide complet (GUIDE_ETAPE_PAR_ETAPE.md)
  6. ❌ Quitter

"@ -ForegroundColor Cyan

$choice = Read-Host "`nTon choix (1-6)"

switch ($choice) {
  "1" {
    # ANDROID
    Step "1" "ANDROID - Build + Submit"
    
    Info "Vérification que l'app existe dans Play Console..."
    Warn "IMPORTANT : Assure-toi d'avoir créé l'app 'Yukpomnang' dans Play Console"
    Warn "Lien : https://play.google.com/console/"
    Pause "Une fois l'app créée, appuie sur Entrée pour continuer..."
    
    Info "Lancement du build Android (AAB)..."
    Warn "Durée estimée : 15-25 minutes"
    Warn "Tu recevras un lien pour suivre la progression"
    Pause "Prêt à lancer le build ?"
    
    npx eas build --platform android --profile production
    
    if ($LASTEXITCODE -eq 0) {
      Ok "Build Android lancé avec succès !"
      Info "Tu peux suivre la progression sur le dashboard EAS"
      Start-Process "https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds" | Out-Null
    } else {
      Fail "Erreur lors du build Android. Vérifie les logs ci-dessus."
      Pause
      goto MAIN_MENU
    }
    
    Pause "Une fois le build terminé, appuie sur Entrée pour continuer avec la soumission..."
    
    Info "Soumission sur Play Console..."
    
    if (Test-Path "google-service-account.json") {
      Ok "Service Account trouvé. Soumission automatique..."
      npx eas submit --platform android --profile production
      
      if ($LASTEXITCODE -eq 0) {
        Ok "Soumission Android réussie !"
        Info "L'app est maintenant sur la piste 'Internal testing'"
      } else {
        Warn "Soumission automatique échouée. Tu devras uploader manuellement."
        Info "Va sur Play Console → Testing → Internal testing → Créer une version"
        Start-Process "https://play.google.com/console/" | Out-Null
      }
    } else {
      Warn "Service Account non trouvé (google-service-account.json)"
      Warn "Tu devras uploader manuellement l'AAB dans Play Console"
      Info "1. Télécharge l'AAB depuis le dashboard EAS"
      Info "2. Va sur Play Console → Testing → Internal testing"
      Info "3. Crée une version et upload l'AAB"
      Start-Process "https://play.google.com/console/" | Out-Null
      Start-Process "https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds" | Out-Null
    }
    
    Pause "Soumission terminée. Appuie sur Entrée pour continuer..."
    goto MAIN_MENU
  }
  
  "2" {
    # iOS
    Step "2" "iOS - Build + Submit"
    
    Info "Vérification que l'app existe dans App Store Connect..."
    Warn "IMPORTANT : Assure-toi d'avoir créé l'app 'Yukpomnang' dans App Store Connect"
    Warn "Lien : https://appstoreconnect.apple.com/"
    Warn "Bundle ID doit être : com.yukpomnang.mobile"
    Pause "Une fois l'app créée, appuie sur Entrée pour continuer..."
    
    Info "Lancement du build iOS..."
    Warn "Durée estimée : 20-30 minutes"
    Warn "Tu recevras un lien pour suivre la progression"
    Pause "Prêt à lancer le build ?"
    
    npx eas build --platform ios --profile production
    
    if ($LASTEXITCODE -eq 0) {
      Ok "Build iOS lancé avec succès !"
      Info "Tu peux suivre la progression sur le dashboard EAS"
      Start-Process "https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds" | Out-Null
    } else {
      Fail "Erreur lors du build iOS. Vérifie les logs ci-dessus."
      Pause
      goto MAIN_MENU
    }
    
    Pause "Une fois le build terminé, appuie sur Entrée pour continuer avec la soumission..."
    
    Info "Soumission sur TestFlight..."
    Warn "Tu devras peut-être t'authentifier avec ton Apple ID"
    Pause "Prêt à soumettre ?"
    
    npx eas submit --platform ios --profile production
    
    if ($LASTEXITCODE -eq 0) {
      Ok "Soumission iOS réussie !"
      Info "L'app est maintenant sur TestFlight"
      Start-Process "https://appstoreconnect.apple.com/" | Out-Null
    } else {
      Warn "Soumission automatique échouée. Tu devras uploader manuellement."
      Info "Va sur App Store Connect → TestFlight → Ajouter une build"
      Start-Process "https://appstoreconnect.apple.com/" | Out-Null
    }
    
    Pause "Soumission terminée. Appuie sur Entrée pour continuer..."
    goto MAIN_MENU
  }
  
  "3" {
    # Obtenir les liens
    Step "3" "Obtenir les liens partageables"
    
    Write-Host @"

📱 ANDROID (Play Store) - Lien opt-in :

1. Va sur Play Console : https://play.google.com/console/
2. Sélectionne ton app 'Yukpomnang'
3. Menu gauche → Testing → Closed testing (ou Open testing)
4. Crée une version et publie-la
5. Va dans "Testeurs" → "Lien d'inscription" (Opt-in link)
6. Copie le lien (format : https://play.google.com/apps/internet/test/xxxxx)

🍎 iOS (TestFlight) - Lien public :

1. Va sur App Store Connect : https://appstoreconnect.apple.com/
2. Sélectionne ton app 'Yukpomnang'
3. Menu TestFlight → Testeurs externes
4. Crée un groupe et ajoute la build
5. Attends la Beta App Review (si première fois)
6. Va dans "Liens publics" → Crée un lien
7. Copie le lien (format : https://testflight.apple.com/join/xxxxx)

"@ -ForegroundColor White
    
    Start-Process "https://play.google.com/console/" | Out-Null
    Start-Process "https://appstoreconnect.apple.com/" | Out-Null
    
    Pause "J'ai ouvert les deux consoles. Une fois les liens copiés, appuie sur Entrée..."
    goto MAIN_MENU
  }
  
  "4" {
    # Voir les builds
    Info "Liste de tes builds récents..."
    eas build:list --limit 10
    Pause
    goto MAIN_MENU
  }
  
  "5" {
    # Ouvrir le guide
    if (Test-Path "GUIDE_ETAPE_PAR_ETAPE.md") {
      Start-Process "GUIDE_ETAPE_PAR_ETAPE.md"
      Ok "Guide ouvert !"
    } else {
      Warn "Guide non trouvé. Vérifie que GUIDE_ETAPE_PAR_ETAPE.md existe."
    }
    Pause
    goto MAIN_MENU
  }
  
  "6" {
    Ok "Au revoir ! 👋"
    exit 0
  }
  
  default {
    Warn "Choix invalide. Réessaie."
    Start-Sleep -Seconds 1
    goto MAIN_MENU
  }
}




