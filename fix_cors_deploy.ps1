# Script de correction CORS et déploiement
Write-Host "🔧 Correction du problème CORS - Déploiement backend" -ForegroundColor Cyan

# 1. Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "backend/Cargo.toml")) {
    Write-Host "❌ Erreur: Ce script doit être exécuté depuis la racine du projet" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Répertoire correct détecté" -ForegroundColor Green

# 2. Aller dans le répertoire backend
Set-Location backend

Write-Host "📦 Compilation du backend avec corrections CORS..." -ForegroundColor Yellow

# 3. Compiler le backend
try {
    cargo build --release
    Write-Host "✅ Compilation réussie" -ForegroundColor Green
}
catch {
    Write-Host "❌ Erreur de compilation: $_" -ForegroundColor Red
    exit 1
}

# 4. Retourner au répertoire racine
Set-Location ..

Write-Host "🚀 Déploiement des corrections CORS..." -ForegroundColor Yellow

# 5. Commit et push des changements
try {
    git add .
    git commit -m "fix: Correction CORS pour résoudre les erreurs de connexion frontend-backend

- Configuration CORS permissive pour tous les domaines yukpomnang
- Correction des headers CORS par défaut pour Render
- Support des requêtes sans origin (applications mobiles)
- Résolution des erreurs 'Failed to fetch' et timeouts"
    
    git push origin master
    
    Write-Host "✅ Corrections CORS déployées avec succès" -ForegroundColor Green
    Write-Host "🔄 Le backend va redémarrer automatiquement sur Render..." -ForegroundColor Cyan
    Write-Host "⏱️  Attendez 2-3 minutes pour que les changements prennent effet" -ForegroundColor Yellow
    
}
catch {
    Write-Host "❌ Erreur lors du déploiement: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Attendez 2-3 minutes que Render redémarre le backend" -ForegroundColor White
Write-Host "2. Testez la connexion frontend-backend" -ForegroundColor White
Write-Host "3. Vérifiez que les erreurs 'Failed to fetch' ont disparu" -ForegroundColor White
Write-Host ""
Write-Host "🔗 URLs à tester:" -ForegroundColor Cyan
Write-Host "- Backend Health: https://yukpomnang.onrender.com/healthz" -ForegroundColor White
Write-Host "- Frontend: https://yukpomnang.onrender.com" -ForegroundColor White

