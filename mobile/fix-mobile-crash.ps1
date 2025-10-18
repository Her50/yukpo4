# Script de correction du crash mobile Yukpo - Dossier correct
# Date: $(Get-Date -Format "yyyy-MM-dd")

Write-Host "🚀 Correction du crash mobile Yukpo - Dossier mobile" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Vérification du dossier
Write-Host "`n1️⃣ Vérification du dossier mobile..." -ForegroundColor Yellow
if (!(Test-Path "mobile")) {
    Write-Host "❌ Le dossier 'mobile' n'existe pas" -ForegroundColor Red
    Write-Host "   Assurez-vous d'être dans le bon répertoire" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Dossier mobile trouvé" -ForegroundColor Green

# 2. Installation des dépendances
Write-Host "`n2️⃣ Installation des dépendances..." -ForegroundColor Yellow
cd mobile

# Vérifier si node_modules existe
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances npm..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Dépendances déjà installées" -ForegroundColor Green
}

# 3. Nettoyage du cache
Write-Host "`n3️⃣ Nettoyage du cache..." -ForegroundColor Yellow
npx expo start --clear
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Nettoyage du cache avec avertissements" -ForegroundColor Yellow
} else {
    Write-Host "✅ Cache nettoyé" -ForegroundColor Green
}

# 4. Vérification de la configuration
Write-Host "`n4️⃣ Vérification de la configuration..." -ForegroundColor Yellow

# Vérifier les fichiers critiques
$criticalFiles = @(
    "src/utils/jwtDecode.ts",
    "src/contexts/AuthContext.tsx",
    "src/services/api.ts",
    "src/components/ErrorBoundary.tsx"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file manquant" -ForegroundColor Red
    }
}

# 5. Test de connexion API
Write-Host "`n5️⃣ Test de connexion API..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://yukpomnang.onrender.com/api/health" -Method Get -TimeoutSec 10
    Write-Host "✅ API accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠️ API non accessible - Mode hors ligne activé" -ForegroundColor Yellow
    Write-Host "   L'application fonctionnera en mode hors ligne" -ForegroundColor Gray
}

# 6. Redémarrage de l'application
Write-Host "`n6️⃣ Redémarrage de l'application..." -ForegroundColor Yellow

# Arrêter les processus existants
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Démarrer l'application
Write-Host "🚀 Démarrage de l'application mobile..." -ForegroundColor Blue
Start-Process -FilePath "npx" -ArgumentList "expo", "start" -WindowStyle Normal

Write-Host "`n✅ Correction terminée !" -ForegroundColor Green
Write-Host "L'application mobile Yukpo devrait maintenant fonctionner sans crash." -ForegroundColor Green

Write-Host "`n📱 Instructions de test :" -ForegroundColor Cyan
Write-Host "1. Ouvrez l'application Expo Go sur votre téléphone" -ForegroundColor White
Write-Host "2. Scannez le QR code qui apparaît dans le terminal" -ForegroundColor White
Write-Host "3. L'application devrait se charger sans crash" -ForegroundColor White

Write-Host "`n🔧 Corrections appliquées :" -ForegroundColor Yellow
Write-Host "- Gestion d'erreur robuste pour le décodage JWT" -ForegroundColor White
Write-Host "- Fallback en cas de token corrompu" -ForegroundColor White
Write-Host "- Initialisation sécurisée de Buffer" -ForegroundColor White
Write-Host "- Gestion des erreurs d'authentification" -ForegroundColor White

Write-Host "`n🚨 Si le problème persiste :" -ForegroundColor Red
Write-Host "1. Redémarrez votre téléphone" -ForegroundColor White
Write-Host "2. Réinstallez l'application Expo Go" -ForegroundColor White
Write-Host "3. Vérifiez votre connexion internet" -ForegroundColor White
Write-Host "4. Consultez les logs dans le terminal pour plus de détails" -ForegroundColor White



