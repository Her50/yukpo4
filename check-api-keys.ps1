# 🔧 Script de diagnostic et configuration API Keys pour Render.com
# Usage: .\check-api-keys.ps1

Write-Host "🔍 Diagnostic des clés API Yukpomnang" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Yellow

# Variables d'environnement nécessaires identifiées dans le backend
$RequiredKeys = @{
    "OPENAI_API_KEY" = "Clé API OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)"
    "MISTRAL_API_KEY" = "Clé API Mistral AI"
    "GEMINI_API_KEY" = "Clé API Google Gemini Pro"
    "ANTHROPIC_API_KEY" = "Clé API Anthropic Claude"
    "YUKPO_API_KEY" = "Clé API interne Yukpo pour embeddings"
    "DATABASE_URL" = "URL PostgreSQL de la base de données"
    "MONGODB_URL" = "URL MongoDB pour l'historisation"
    "REDIS_URL" = "URL Redis pour le cache"
    "JWT_SECRET" = "Secret JWT pour l'authentification"
}

Write-Host "📋 Variables d'environnement requises:" -ForegroundColor Green
foreach ($key in $RequiredKeys.Keys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if ($value) {
        $maskedValue = $key -match "KEY|SECRET|URL" ? "***...${value.Substring([Math]::Max(0, $value.Length - 6))}" : $value
        Write-Host "  ✅ $key = $maskedValue" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $key = NON DÉFINIE" -ForegroundColor Red
        Write-Host "     📝 $($RequiredKeys[$key])" -ForegroundColor Gray
    }
}

Write-Host "`n🚀 Configuration pour Render.com:" -ForegroundColor Cyan
Write-Host "Pour configurer ces variables sur Render.com :" -ForegroundColor Yellow
Write-Host "1. Allez sur https://dashboard.render.com" -ForegroundColor White
Write-Host "2. Sélectionnez votre service 'yukpomnang'" -ForegroundColor White  
Write-Host "3. Onglet 'Environment'" -ForegroundColor White
Write-Host "4. Ajoutez ces variables:" -ForegroundColor White

Write-Host "`n📝 Variables critiques manquantes à ajouter:" -ForegroundColor Red
foreach ($key in $RequiredKeys.Keys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if (-not $value) {
        Write-Host "   $key = [VOTRE_CLÉ_ICI]" -ForegroundColor Yellow
    }
}

Write-Host "`n🔧 Problèmes identifiés dans l'application:" -ForegroundColor Cyan
Write-Host "1. ❌ OpenAI non utilisé → OPENAI_API_KEY manquante" -ForegroundColor Red
Write-Host "2. ❌ Erreur 400 /api/services/last → JWT ou DB issue" -ForegroundColor Red  
Write-Host "3. ❌ Erreur 500 GPS → GPS consent ou DB issue" -ForegroundColor Red

Write-Host "`n🎯 Actions recommandées:" -ForegroundColor Green
Write-Host "1. Configurez OPENAI_API_KEY sur Render.com" -ForegroundColor White
Write-Host "2. Vérifiez DATABASE_URL et MONGODB_URL" -ForegroundColor White
Write-Host "3. Redéployez le service backend" -ForegroundColor White
Write-Host "4. Testez les fonctionnalités IA" -ForegroundColor White

Write-Host "`n💡 Pour obtenir les clés API:" -ForegroundColor Blue
Write-Host "• OpenAI: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "• Mistral: https://console.mistral.ai/api-keys/" -ForegroundColor White
Write-Host "• Gemini: https://aistudio.google.com/app/apikey" -ForegroundColor White
Write-Host "• Anthropic: https://console.anthropic.com/account/keys" -ForegroundColor White

Write-Host "`n✅ Vérification terminée!" -ForegroundColor Green 