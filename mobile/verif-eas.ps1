# Script de vérification EAS Build pour Yukpomnang Mobile
# Exécution : powershell -ExecutionPolicy Bypass -File ./verif-eas.ps1

Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     🔍 VÉRIFICATION EAS BUILD - YUKPOMNANG MOBILE       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Vérifier qu'on est dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur : package.json non trouvé" -ForegroundColor Red
    Write-Host "   Exécutez ce script depuis le dossier mobile/" -ForegroundColor Yellow
    exit 1
}

$allChecks = @()

# 1. Vérifier Node et NPM
Write-Host "`n📦 ÉTAPE 1/10 : Versions Node/NPM" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "   Node : $nodeVersion" -ForegroundColor White
Write-Host "   NPM  : $npmVersion" -ForegroundColor White
if ($nodeVersion -match "v1[89]|v[2-9][0-9]") {
    Write-Host "   ✅ Version Node compatible" -ForegroundColor Green
    $allChecks += $true
}
else {
    Write-Host "   ⚠️  Node version ancienne (recommandé : 18+)" -ForegroundColor Yellow
    $allChecks += $false
}

# 2. Vérifier Expo CLI
Write-Host "`n📦 ÉTAPE 2/10 : Version Expo CLI" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
try {
    $expoVersion = npx expo --version 2>&1
    Write-Host "   Expo : $expoVersion" -ForegroundColor White
    Write-Host "   ✅ Expo CLI disponible" -ForegroundColor Green
    $allChecks += $true
}
catch {
    Write-Host "   ❌ Expo CLI non disponible" -ForegroundColor Red
    $allChecks += $false
}

# 3. Vérifier EAS CLI
Write-Host "`n📦 ÉTAPE 3/10 : Version EAS CLI" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
try {
    $easVersion = eas --version 2>&1
    Write-Host "   EAS  : $easVersion" -ForegroundColor White
    Write-Host "   ✅ EAS CLI installé" -ForegroundColor Green
    $allChecks += $true
}
catch {
    Write-Host "   ❌ EAS CLI non installé" -ForegroundColor Red
    Write-Host "   👉 Installez avec : npm install -g eas-cli" -ForegroundColor Yellow
    $allChecks += $false
}

# 4. Vérifier les fichiers critiques
Write-Host "`n📁 ÉTAPE 4/10 : Fichiers critiques" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
$criticalFiles = @(
    "package.json",
    "app.config.js",
    "eas.json",
    "App.tsx",
    "babel.config.js"
)

$filesOk = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $file - MANQUANT" -ForegroundColor Red
        $filesOk = $false
    }
}
$allChecks += $filesOk

# 5. Vérifier les assets
Write-Host "`n🎨 ÉTAPE 5/10 : Assets (icônes et splash)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
$assetFiles = @(
    "assets/icon.png",
    "assets/splash.png",
    "assets/adaptive-icon.png"
)

$assetsOk = $true
foreach ($asset in $assetFiles) {
    if (Test-Path $asset) {
        Write-Host "   ✅ $asset" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  $asset - MANQUANT" -ForegroundColor Yellow
        $assetsOk = $false
    }
}
$allChecks += $assetsOk

# 6. Vérifier les plugins
Write-Host "`n🔌 ÉTAPE 6/10 : Plugins Expo" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
$pluginFiles = @(
    "plugins/withKotlinVersion.js",
    "plugins/withWebRTCExpo53.js",
    "plugins/disableUpdates.js"
)

$pluginsOk = $true
foreach ($plugin in $pluginFiles) {
    if (Test-Path $plugin) {
        Write-Host "   ✅ $plugin" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $plugin - MANQUANT" -ForegroundColor Red
        $pluginsOk = $false
    }
}
$allChecks += $pluginsOk

# 7. Vérifier les scripts EAS
Write-Host "`n📜 ÉTAPE 7/10 : Scripts EAS Build" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
$easScripts = @(
    "eas-build-pre-install.sh",
    "eas-build-post-install.sh"
)

$scriptsOk = $true
foreach ($script in $easScripts) {
    if (Test-Path $script) {
        Write-Host "   ✅ $script" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $script - MANQUANT" -ForegroundColor Red
        $scriptsOk = $false
    }
}
$allChecks += $scriptsOk

# 8. Vérifier node_modules
Write-Host "`n📦 ÉTAPE 8/10 : Dépendances (node_modules)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
if (Test-Path "node_modules") {
    $packageCount = (Get-ChildItem node_modules -Directory -ErrorAction SilentlyContinue).Count
    Write-Host "   ✅ node_modules présent ($packageCount packages)" -ForegroundColor Green
    $allChecks += $true
}
else {
    Write-Host "   ❌ node_modules manquant" -ForegroundColor Red
    Write-Host "   👉 Exécutez : npm install" -ForegroundColor Yellow
    $allChecks += $false
}

# 9. Vérifier la connexion EAS
Write-Host "`n🔐 ÉTAPE 9/10 : Connexion EAS" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
try {
    $whoami = eas whoami 2>&1
    if ($whoami -match "hernandezlele") {
        Write-Host "   ✅ Connecté en tant que : $whoami" -ForegroundColor Green
        $allChecks += $true
    }
    elseif ($whoami -match "Not logged in") {
        Write-Host "   ❌ Non connecté à EAS" -ForegroundColor Red
        Write-Host "   👉 Exécutez : eas login" -ForegroundColor Yellow
        $allChecks += $false
    }
    else {
        Write-Host "   ⚠️  Connecté mais pas avec le bon compte" -ForegroundColor Yellow
        Write-Host "   👉 Compte actuel : $whoami" -ForegroundColor White
        Write-Host "   👉 Compte requis : hernandezlele" -ForegroundColor White
        $allChecks += $false
    }
}
catch {
    Write-Host "   ❌ Impossible de vérifier la connexion EAS" -ForegroundColor Red
    $allChecks += $false
}

# 10. Vérifier la configuration EAS dans app.config.js
Write-Host "`n⚙️  ÉTAPE 10/10 : Configuration Project ID" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
if (Test-Path "app.config.js") {
    $configContent = Get-Content "app.config.js" -Raw
    # Project ID EAS défini dans app.config.js (extra.eas.projectId)
    if ($configContent -match "944bbf0d-5541-4e56-ba75-87ffc4c5e51f") {
        Write-Host "   ✅ Project ID EAS configuré" -ForegroundColor Green
        $allChecks += $true
    }
    else {
        Write-Host "   ❌ Project ID EAS manquant ou incorrect" -ForegroundColor Red
        $allChecks += $false
    }
}
else {
    Write-Host "   ❌ app.config.js non trouvé" -ForegroundColor Red
    $allChecks += $false
}

# Résumé final
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                   RÉSUMÉ DES VÉRIFICATIONS               ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$passedChecks = ($allChecks | Where-Object { $_ -eq $true }).Count
$totalChecks = $allChecks.Count
$percentage = [math]::Round(($passedChecks / $totalChecks) * 100, 0)

Write-Host "   📊 Vérifications réussies : $passedChecks/$totalChecks ($percentage%)" -ForegroundColor White

if ($passedChecks -eq $totalChecks) {
    Write-Host @"

   ✨ TOUTES LES VÉRIFICATIONS SONT OK ! ✨

   Vous pouvez lancer le build EAS avec :
   
   npx eas build --platform android --profile preview

"@ -ForegroundColor Green
}
elseif ($percentage -ge 80) {
    Write-Host @"

   ⚠️  QUELQUES PROBLÈMES MINEURS

   Corrigez les warnings ci-dessus avant de lancer le build.

"@ -ForegroundColor Yellow
}
else {
    Write-Host @"

   ❌ PROBLÈMES CRITIQUES DÉTECTÉS

   Corrigez TOUS les problèmes ci-dessus avant de lancer le build.

"@ -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host " Pour plus d'informations, consultez : GUIDE_EAS_BUILD.md" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "`n"

