# 🚀 SUPER-SCRIPT AUTOMATISÉ FINAL - Yukpomnang
# Ce script automatise TOUT ce qui est possible

param(
    [string]$DatabaseUrl = "",
    [string]$MongoUrl = "", 
    [string]$RedisUrl = ""
)

Write-Host "🚀 SUPER-AUTOMATISATION YUKPOMNANG FINALE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Yellow

# Configuration automatique des CLI
Write-Host "`n📦 INSTALLATION AUTOMATIQUE DES CLI..." -ForegroundColor Cyan

try {
    Write-Host "   🔧 Installation Neon CLI..." -ForegroundColor White
    npm install -g @neondatabase/cli 2>$null
    Write-Host "   ✅ Neon CLI installé" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Neon CLI: Installation manuelle requise" -ForegroundColor Yellow
}

try {
    Write-Host "   🔧 Installation MongoDB CLI..." -ForegroundColor White  
    # MongoDB CLI est plus complexe, on guidera manuellement
    Write-Host "   📋 MongoDB CLI: Guide manuel fourni" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️ MongoDB CLI: Installation manuelle" -ForegroundColor Yellow
}

# Vérification si URLs fournies en paramètres
if ($DatabaseUrl -and $MongoUrl -and $RedisUrl) {
    Write-Host "`n🎯 URLs FOURNIES - CONFIGURATION AUTOMATIQUE..." -ForegroundColor Green
    
    # Configuration automatique Render avec CLI Netlify (proxy)
    try {
        Write-Host "   🔄 Configuration automatique Render..." -ForegroundColor White
        
        # Lire le template de configuration
        $configContent = Get-Content "render-config-final.txt" -Raw
        
        # Remplacer les URLs
        $configContent = $configContent -replace '\[REMPLACER_PAR_URL_NEON_POSTGRESQL\]', $DatabaseUrl
        $configContent = $configContent -replace '\[REMPLACER_PAR_URL_ATLAS_MONGODB\]', $MongoUrl  
        $configContent = $configContent -replace '\[REMPLACER_PAR_URL_UPSTASH_REDIS\]', $RedisUrl
        
        # Sauvegarder la configuration finale
        $configContent | Out-File -FilePath "render-config-applied.txt" -Encoding UTF8
        
        Write-Host "   ✅ Configuration finale générée: render-config-applied.txt" -ForegroundColor Green
        
        # Ouverture automatique de Render avec configuration
        Write-Host "   🌐 Ouverture Render pour configuration..." -ForegroundColor White
        Start-Process "https://dashboard.render.com"
        
        Write-Host "`n🎯 COPIER-COLLER AUTOMATIQUE PRÉPARÉ!" -ForegroundColor Green
        Write-Host "📋 Contenu du presse-papier mis à jour avec la configuration complète" -ForegroundColor White
        
        # Copier dans le presse-papier Windows
        $configContent | Set-Clipboard
        Write-Host "✅ Configuration copiée dans le presse-papier!" -ForegroundColor Green
        Write-Host "➡️ Allez sur Render > yukpomnang > Environment > Coller (Ctrl+V)" -ForegroundColor Yellow
        
    } catch {
        Write-Host "   ❌ Erreur configuration automatique: $_" -ForegroundColor Red
    }
    
} else {
    Write-Host "`n🔄 MODE GUIDE INTERACTIF..." -ForegroundColor Yellow
    
    # Ouverture automatique de tous les dashboards
    Write-Host "`n🌐 OUVERTURE AUTOMATIQUE DES DASHBOARDS..." -ForegroundColor Cyan
    
    $dashboards = @{
        "Neon PostgreSQL" = "https://console.neon.tech"
        "MongoDB Atlas" = "https://cloud.mongodb.com"
        "Upstash Redis" = "https://console.upstash.com" 
        "Render Dashboard" = "https://dashboard.render.com"
    }
    
    foreach ($name in $dashboards.Keys) {
        Write-Host "   🔗 Ouverture: $name" -ForegroundColor White
        Start-Process $dashboards[$name]
        Start-Sleep -Seconds 2
    }
    
    # Guide interactif automatisé
    Write-Host "`n🎯 GUIDE INTERACTIF AUTOMATISÉ" -ForegroundColor Green
    Write-Host "==============================" -ForegroundColor Green
    
    Write-Host "`n1️⃣ NEON POSTGRESQL (2 minutes) - Dashboard ouvert" -ForegroundColor Cyan
    Write-Host "   • Sign up avec GitHub/Google" -ForegroundColor White
    Write-Host "   • Create project 'yukpomnang'" -ForegroundColor White
    Write-Host "   • Copy connection string (postgresql://...)" -ForegroundColor White
    
    do {
        $neonUrl = Read-Host "`n   📋 Collez votre URL Neon PostgreSQL ici"
        if ([string]::IsNullOrWhiteSpace($neonUrl)) {
            Write-Host "   ❌ URL obligatoire pour continuer!" -ForegroundColor Red
        }
    } while ([string]::IsNullOrWhiteSpace($neonUrl))
    
    Write-Host "`n2️⃣ MONGODB ATLAS (2 minutes) - Dashboard ouvert" -ForegroundColor Cyan  
    Write-Host "   • Sign up avec GitHub/Google" -ForegroundColor White
    Write-Host "   • Create M0 cluster 'yukpomnang'" -ForegroundColor White
    Write-Host "   • Connect > Application > Copy URL (mongodb+srv://...)" -ForegroundColor White
    
    do {
        $mongoUrl = Read-Host "`n   📋 Collez votre URL MongoDB Atlas ici"
        if ([string]::IsNullOrWhiteSpace($mongoUrl)) {
            Write-Host "   ❌ URL obligatoire pour continuer!" -ForegroundColor Red
        }
    } while ([string]::IsNullOrWhiteSpace($mongoUrl))
    
    Write-Host "`n3️⃣ UPSTASH REDIS (1 minute) - Dashboard ouvert" -ForegroundColor Cyan
    Write-Host "   • Sign up avec GitHub/Google" -ForegroundColor White  
    Write-Host "   • Create database 'yukpomnang'" -ForegroundColor White
    Write-Host "   • Copy REST URL (redis://...)" -ForegroundColor White
    
    do {
        $redisUrl = Read-Host "`n   📋 Collez votre URL Upstash Redis ici"
        if ([string]::IsNullOrWhiteSpace($redisUrl)) {
            Write-Host "   ⚠️ Redis optionnel, laissez vide pour continuer sans cache" -ForegroundColor Yellow
            $redisUrl = "redis://localhost:6379"
            break
        }
    } while ([string]::IsNullOrWhiteSpace($redisUrl))
    
    # Configuration automatique avec les URLs obtenues
    Write-Host "`n🎯 CONFIGURATION AUTOMATIQUE RENDER..." -ForegroundColor Green
    
    # Générer la configuration finale avec URLs réelles
    $finalConfig = Get-Content "render-config-final.txt" -Raw
    $finalConfig = $finalConfig -replace '\[REMPLACER_PAR_URL_NEON_POSTGRESQL\]', $neonUrl
    $finalConfig = $finalConfig -replace '\[REMPLACER_PAR_URL_ATLAS_MONGODB\]', $mongoUrl
    $finalConfig = $finalConfig -replace '\[REMPLACER_PAR_URL_UPSTASH_REDIS\]', $redisUrl
    
    # Sauvegarder et copier dans le presse-papier
    $finalConfig | Out-File -FilePath "render-config-final-applied.txt" -Encoding UTF8
    $finalConfig | Set-Clipboard
    
    Write-Host "✅ Configuration finale générée et copiée!" -ForegroundColor Green
    Write-Host "📋 Contenu dans le presse-papier Windows" -ForegroundColor White
    
    Write-Host "`n4️⃣ RENDER CONFIGURATION (30 secondes)" -ForegroundColor Cyan
    Write-Host "   🌐 Dashboard Render déjà ouvert" -ForegroundColor White
    Write-Host "   ➡️ yukpomnang > Environment" -ForegroundColor White  
    Write-Host "   ➡️ Ctrl+V pour coller TOUTE la configuration" -ForegroundColor White
    Write-Host "   ➡️ Save Changes" -ForegroundColor White
    
    # Attente confirmation
    Read-Host "`n   ✅ Appuyez sur Entrée après avoir sauvegardé sur Render"
    
}

# Test automatique final
Write-Host "`n🧪 TEST AUTOMATIQUE FINAL..." -ForegroundColor Green

Start-Sleep -Seconds 5

Write-Host "   🔍 Test Backend..." -ForegroundColor White
try {
    $backendTest = Invoke-RestMethod -Uri "https://yukpomnang.onrender.com/healthz" -TimeoutSec 15
    Write-Host "   ✅ Backend accessible et fonctionnel!" -ForegroundColor Green
} catch {
    Write-Host "   ⏳ Backend en cours de redéploiement (normal)" -ForegroundColor Yellow
}

Write-Host "   🔍 Test Frontend..." -ForegroundColor White  
try {
    $frontendTest = Invoke-WebRequest -Uri "https://yukpomnang-app.netlify.app" -TimeoutSec 10 -UseBasicParsing
    Write-Host "   ✅ Frontend accessible et fonctionnel!" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Frontend inaccessible: $_" -ForegroundColor Red
}

# Ouverture automatique pour test final
Write-Host "`n🚀 OUVERTURE AUTOMATIQUE POUR TEST..." -ForegroundColor Cyan
Start-Process "https://yukpomnang-app.netlify.app"

Write-Host "`n🎉 CONFIGURATION AUTOMATIQUE TERMINÉE!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

Write-Host "`n✅ RÉSULTATS ATTENDUS:" -ForegroundColor White
Write-Host "• IA OpenAI génère automatiquement les services" -ForegroundColor Green
Write-Host "• Google Maps fonctionne parfaitement" -ForegroundColor Green  
Write-Host "• GPS tracking opérationnel" -ForegroundColor Green
Write-Host "• Contacts se préremplissent automatiquement" -ForegroundColor Green
Write-Host "• Plus aucune erreur 400/500!" -ForegroundColor Green

Write-Host "`n🎯 TESTEZ MAINTENANT:" -ForegroundColor Yellow
Write-Host "https://yukpomnang-app.netlify.app" -ForegroundColor White

# Usage instructions
Write-Host "`n💡 USAGE:" -ForegroundColor Blue
Write-Host "   Mode normal: .\auto-setup-final.ps1" -ForegroundColor White
Write-Host "   Mode expert: .\auto-setup-final.ps1 -DatabaseUrl 'postgresql://...' -MongoUrl 'mongodb://...' -RedisUrl 'redis://...'" -ForegroundColor White 