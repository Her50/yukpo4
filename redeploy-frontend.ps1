# Script pour redéployer le frontend avec la nouvelle configuration
Write-Host "🚀 Redéploiement du frontend avec la nouvelle configuration API" -ForegroundColor Green

# Aller dans le dossier frontend
Set-Location frontend

Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
npm install

Write-Host "🔨 Build de l'application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build réussi!" -ForegroundColor Green
    
    Write-Host "🌐 Déploiement sur Netlify..." -ForegroundColor Yellow
    
    # Vérifier si netlify-cli est installé
    try {
        netlify --version | Out-Null
        Write-Host "✅ Netlify CLI détecté" -ForegroundColor Green
        
        # Déployer sur Netlify
        netlify deploy --prod --dir=dist
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "🎉 Déploiement réussi!" -ForegroundColor Green
            Write-Host "🌐 URL: https://yukpomnang-app.netlify.app" -ForegroundColor Cyan
            Write-Host "⏳ Attendez 2-3 minutes que le déploiement soit actif..." -ForegroundColor Yellow
        } else {
            Write-Host "❌ Erreur lors du déploiement Netlify" -ForegroundColor Red
        }
    } catch {
        Write-Host "⚠️ Netlify CLI non installé. Installation..." -ForegroundColor Yellow
        npm install -g netlify-cli
        
        Write-Host "🌐 Déploiement sur Netlify..." -ForegroundColor Yellow
        netlify deploy --prod --dir=dist
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "🎉 Déploiement réussi!" -ForegroundColor Green
            Write-Host "🌐 URL: https://yukpomnang-app.netlify.app" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Erreur lors du déploiement Netlify" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ Erreur lors du build" -ForegroundColor Red
}

# Retourner au dossier racine
Set-Location ..

Write-Host "🏁 Script terminé." -ForegroundColor Cyan
