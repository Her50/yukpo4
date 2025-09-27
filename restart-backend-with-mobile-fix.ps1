# Script pour redémarrer le backend avec les corrections pour l'application mobile
# Ce script applique les corrections CORS et redémarre le backend

Write-Host "🔧 Application des corrections pour l'application mobile..." -ForegroundColor Green

# Aller dans le dossier backend
Set-Location backend

Write-Host "📦 Compilation du backend avec les corrections CORS..." -ForegroundColor Yellow

# Compiler le backend
try {
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Compilation réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur de compilation" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la compilation: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Redémarrage du backend..." -ForegroundColor Yellow

# Arrêter le backend s'il tourne déjà
try {
    Get-Process -Name "yukpomnang_backend" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "🛑 Backend précédent arrêté" -ForegroundColor Yellow
} catch {
    Write-Host "ℹ️ Aucun backend précédent à arrêter" -ForegroundColor Blue
}

# Attendre un peu
Start-Sleep -Seconds 2

# Démarrer le backend
try {
    Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory (Get-Location) -WindowStyle Hidden
    Write-Host "🚀 Backend redémarré avec les corrections CORS" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du démarrage du backend: $_" -ForegroundColor Red
    exit 1
}

# Retourner au dossier racine
Set-Location ..

Write-Host "`n✅ Corrections appliquées avec succès !" -ForegroundColor Green
Write-Host "📱 L'application mobile peut maintenant se connecter au backend" -ForegroundColor Cyan
Write-Host "🌐 Backend disponible sur: https://yukpomnang.onrender.com" -ForegroundColor Yellow

Write-Host "`n🔍 Vérifications à effectuer:" -ForegroundColor Magenta
Write-Host "1. Tester la connexion depuis l'application mobile" -ForegroundColor White
Write-Host "2. Tester l'inscription depuis l'application mobile" -ForegroundColor White
Write-Host "3. Vérifier que les boutons sont bien positionnés" -ForegroundColor White
Write-Host "4. Vérifier que la navigation fonctionne après authentification" -ForegroundColor White
