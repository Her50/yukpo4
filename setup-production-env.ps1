# 🚀 Configuration automatique des variables d'environnement
# Usage: .\setup-production-env.ps1

Write-Host "🚀 Configuration Production Yukpomnang" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Yellow

# Variables critiques à configurer
$criticalVars = @{
    "DATABASE_URL" = @{
        "description" = "URL PostgreSQL de votre base de données"
        "example" = "postgresql://username:password@host:port/database"
        "platform" = "Render"
        "required" = $true
    }
    "JWT_SECRET" = @{
        "description" = "Secret JWT pour l'authentification (64 caractères)"
        "example" = "Généré automatiquement"
        "platform" = "Render"
        "required" = $true
    }
    "MONGODB_URL" = @{
        "description" = "URL MongoDB pour l'historique"
        "example" = "mongodb://username:password@host:port/database"
        "platform" = "Render"
        "required" = $true
    }
    "GOOGLE_MAPS_API_KEY" = @{
        "description" = "Clé API Google Maps (backend + frontend)"
        "example" = "AIza..."
        "platform" = "Render + Netlify"
        "required" = $true
    }
    "REDIS_URL" = @{
        "description" = "URL Redis pour le cache (optionnel)"
        "example" = "redis://username:password@host:port"
        "platform" = "Render"
        "required" = $false
    }
}

Write-Host "📋 Variables d'environnement à configurer:" -ForegroundColor Green

# Collecte des informations
$config = @{}
foreach ($varName in $criticalVars.Keys) {
    $varInfo = $criticalVars[$varName]
    
    Write-Host "`n🔧 Configuration de $varName" -ForegroundColor Cyan
    Write-Host "   📝 Description: $($varInfo.description)" -ForegroundColor Gray
    Write-Host "   🎯 Plateforme: $($varInfo.platform)" -ForegroundColor Gray
    Write-Host "   📄 Exemple: $($varInfo.example)" -ForegroundColor Gray
    
    if ($varName -eq "JWT_SECRET") {
        # Générer automatiquement le JWT Secret
        Write-Host "   🔐 Génération automatique du JWT Secret..." -ForegroundColor Yellow
        $jwtSecret = -join (1..64 | ForEach-Object { [char]((65..90) + (97..122) + (48..57) | Get-Random) })
        $config[$varName] = $jwtSecret
        Write-Host "   ✅ JWT Secret généré: $($jwtSecret.Substring(0,16))..." -ForegroundColor Green
    } elseif ($varInfo.required) {
        do {
            $value = Read-Host "   💼 Entrez la valeur pour $varName (REQUIS)"
            if ([string]::IsNullOrWhiteSpace($value)) {
                Write-Host "   ❌ Cette variable est obligatoire!" -ForegroundColor Red
            }
        } while ([string]::IsNullOrWhiteSpace($value))
        $config[$varName] = $value
    } else {
        $value = Read-Host "   💼 Entrez la valeur pour $varName (Optionnel, Entrée pour ignorer)"
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $config[$varName] = $value
        }
    }
}

Write-Host "`n📋 RÉSUMÉ DE CONFIGURATION" -ForegroundColor Yellow
Write-Host "=========================" -ForegroundColor Yellow

# Générer les instructions pour Render.com
Write-Host "`n🚀 RENDER.COM - Variables Backend:" -ForegroundColor Cyan
Write-Host "Dashboard: https://dashboard.render.com" -ForegroundColor White
Write-Host "Service: yukpomnang > Environment" -ForegroundColor White
Write-Host "---"

foreach ($varName in $config.Keys) {
    $varInfo = $criticalVars[$varName]
    if ($varInfo.platform -match "Render") {
        $maskedValue = $varName -match "SECRET|KEY|URL|PASSWORD" ? "$($config[$varName].Substring(0,[Math]::Min(12,$config[$varName].Length)))..." : $config[$varName]
        Write-Host "✅ $varName = $maskedValue" -ForegroundColor Green
    }
}

# Variables constantes Render
Write-Host "✅ OPENAI_API_KEY = ✅ DÉJÀ CONFIGURÉ" -ForegroundColor Green
Write-Host "✅ ENABLE_AI_OPTIMIZATIONS = true" -ForegroundColor Green
Write-Host "✅ ENVIRONMENT = production" -ForegroundColor Green
Write-Host "✅ RUST_LOG = info" -ForegroundColor Green

# Générer les instructions pour Netlify
Write-Host "`n🌐 NETLIFY.COM - Variables Frontend:" -ForegroundColor Blue
Write-Host "Dashboard: https://app.netlify.com" -ForegroundColor White
Write-Host "Site: yukpomnang-app > Site settings > Environment variables" -ForegroundColor White
Write-Host "---"

if ($config.ContainsKey("GOOGLE_MAPS_API_KEY")) {
    Write-Host "✅ VITE_APP_GOOGLE_MAPS_API_KEY = $($config["GOOGLE_MAPS_API_KEY"].Substring(0,12))..." -ForegroundColor Green
}
Write-Host "✅ VITE_API_BASE_URL = https://yukpomnang.onrender.com" -ForegroundColor Green
Write-Host "✅ VITE_APP_ENV = production" -ForegroundColor Green
Write-Host "✅ VITE_APP_DEBUG = false" -ForegroundColor Green

# Sauvegarde dans un fichier
Write-Host "`n💾 Sauvegarde de la configuration..." -ForegroundColor Yellow

$renderConfig = @"
# RENDER.COM - Variables Backend
# Ajoutez ces variables dans: https://dashboard.render.com > yukpomnang > Environment

"@

foreach ($varName in $config.Keys) {
    $varInfo = $criticalVars[$varName]
    if ($varInfo.platform -match "Render") {
        $renderConfig += "$varName=$($config[$varName])`n"
    }
}

$renderConfig += @"
OPENAI_API_KEY=✅ DÉJÀ CONFIGURÉ
ENABLE_AI_OPTIMIZATIONS=true
ENVIRONMENT=production
RUST_LOG=info
YUKPO_API_KEY=yukpo_embedding_key_2024
"@

$renderConfig | Out-File -FilePath "render-env-config.txt" -Encoding UTF8

$netlifyConfig = @"
# NETLIFY.COM - Variables Frontend
# Ajoutez ces variables dans: https://app.netlify.com > yukpomnang-app > Environment variables

VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_APP_ENV=production
VITE_APP_DEBUG=false
"@

if ($config.ContainsKey("GOOGLE_MAPS_API_KEY")) {
    $netlifyConfig += "VITE_APP_GOOGLE_MAPS_API_KEY=$($config["GOOGLE_MAPS_API_KEY"])`n"
}

$netlifyConfig | Out-File -FilePath "netlify-env-config.txt" -Encoding UTF8

Write-Host "`n✅ Configuration sauvegardée:" -ForegroundColor Green
Write-Host "   📄 render-env-config.txt - Variables pour Render.com" -ForegroundColor White
Write-Host "   📄 netlify-env-config.txt - Variables pour Netlify.com" -ForegroundColor White

Write-Host "`n🎯 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. 🚀 Configurez les variables sur Render.com (backend)" -ForegroundColor White
Write-Host "2. 🌐 Configurez les variables sur Netlify.com (frontend)" -ForegroundColor White
Write-Host "3. ⏳ Attendez le redéploiement automatique (3-5 min)" -ForegroundColor White
Write-Host "4. 🧪 Testez l'application: https://yukpomnang-app.netlify.app" -ForegroundColor White

Write-Host "`n💡 LIENS UTILES:" -ForegroundColor Blue
Write-Host "• Render Dashboard: https://dashboard.render.com" -ForegroundColor White
Write-Host "• Netlify Dashboard: https://app.netlify.com" -ForegroundColor White
Write-Host "• Google Maps API: https://console.cloud.google.com/apis/credentials" -ForegroundColor White
Write-Host "• MongoDB Atlas: https://cloud.mongodb.com" -ForegroundColor White

Write-Host "`n🎉 Configuration terminée!" -ForegroundColor Green 