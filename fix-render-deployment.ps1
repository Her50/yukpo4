# Script de correction des erreurs de déploiement Render
# Ce script diagnostique et corrige les problèmes courants sur Render

Write-Host "🔧 DIAGNOSTIC ET CORRECTION RENDER" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Variables d'environnement critiques pour Render
$criticalEnvVars = @{
    "DATABASE_URL" = "postgresql://user:pass@ep-rapid-field-40567589.us-east-1.aws.neon.tech/yukpomnang"
    "JWT_SECRET" = "BtKUxxb1AqrkMbqsz0VE3s4wuGahybpyJreiruDQp3MhN8R56jGaA5I8Qc832C8t"
    "OPENAI_API_KEY" = "sk-proj-[VOTRE_CLE_OPENAI_ICI]"
    "YUKPO_API_KEY" = "yukpo_embedding_key_2024"
    "ENVIRONMENT" = "production"
    "RUST_LOG" = "info"
    "HOST" = "0.0.0.0"
    "PORT" = "3001"
}

# Variables d'optimisation
$optimizationVars = @{
    "ENABLE_AI_OPTIMIZATIONS" = "true"
    "EMBEDDING_TIMEOUT_SECONDS" = "60"
    "EMBEDDING_MAX_RETRIES" = "3"
    "REQUEST_TIMEOUT" = "30"
    "DATABASE_TIMEOUT" = "10"
    "DB_POOL_SIZE" = "10"
    "API_RATE_LIMIT_PER_MINUTE" = "100"
    "CACHE_DEFAULT_TTL" = "3600"
}

# Variables Google Maps
$googleVars = @{
    "GOOGLE_MAPS_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "GOOGLE_TRANSLATE_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
}

Write-Host "`n📋 VARIABLES CRITIQUES À CONFIGURER SUR RENDER:" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow

Write-Host "`n🔐 SÉCURITÉ (OBLIGATOIRE):" -ForegroundColor Red
foreach ($var in $criticalEnvVars.GetEnumerator()) {
    if ($var.Key -eq "OPENAI_API_KEY") {
        Write-Host "  $($var.Key)=[REMPLACER_PAR_VOTRE_CLE_OPENAI]" -ForegroundColor Red
    } else {
        Write-Host "  $($var.Key)=$($var.Value)" -ForegroundColor Green
    }
}

Write-Host "`n⚡ OPTIMISATIONS (RECOMMANDÉ):" -ForegroundColor Blue
foreach ($var in $optimizationVars.GetEnumerator()) {
    Write-Host "  $($var.Key)=$($var.Value)" -ForegroundColor Blue
}

Write-Host "`n🗺️ GOOGLE SERVICES (OPTIONNEL):" -ForegroundColor Cyan
foreach ($var in $googleVars.GetEnumerator()) {
    Write-Host "  $($var.Key)=$($var.Value)" -ForegroundColor Cyan
}

Write-Host "`n🚨 ERREURS COURANTES ET SOLUTIONS:" -ForegroundColor Red
Write-Host "=================================" -ForegroundColor Red

Write-Host "`n❌ ERREUR: 'Failed to build'"
Write-Host "   CAUSE: Dockerfile manquant ou incorrect"
Write-Host "   SOLUTION: Vérifier que le Dockerfile est dans le dossier backend/"
Write-Host "   COMMANDE: docker build -t yukpomnang-backend ./backend"

Write-Host "`n❌ ERREUR: 'Database connection failed'"
Write-Host "   CAUSE: DATABASE_URL incorrecte ou base de données inaccessible"
Write-Host "   SOLUTION: Vérifier l'URL de la base de données Neon"
Write-Host "   URL ACTUELLE: postgresql://user:pass@ep-rapid-field-40567589.us-east-1.aws.neon.tech/yukpomnang"

Write-Host "`n❌ ERREUR: 'JWT Secret not configured'"
Write-Host "   CAUSE: JWT_SECRET manquante"
Write-Host "   SOLUTION: Ajouter JWT_SECRET dans les variables d'environnement Render"
Write-Host "   VALEUR: BtKUxxb1AqrkMbqsz0VE3s4wuGahybpyJreiruDQp3MhN8R56jGaA5I8Qc832C8t"

Write-Host "`n❌ ERREUR: 'OpenAI API Key not found'"
Write-Host "   CAUSE: OPENAI_API_KEY manquante"
Write-Host "   SOLUTION: Ajouter votre clé OpenAI dans les variables d'environnement"
Write-Host "   OBTENIR: https://platform.openai.com/api-keys"

Write-Host "`n❌ ERREUR: 'Port binding failed'"
Write-Host "   CAUSE: Application n'écoute pas sur le port correct"
Write-Host "   SOLUTION: Vérifier que l'app écoute sur PORT (variable d'environnement)"

Write-Host "`n🔧 ÉTAPES DE CORRECTION:" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

Write-Host "`n1. 📝 CONFIGURER LES VARIABLES D'ENVIRONNEMENT:"
Write-Host "   - Allez sur https://dashboard.render.com"
Write-Host "   - Sélectionnez votre service 'yukpomnang'"
Write-Host "   - Cliquez sur 'Environment'"
Write-Host "   - Ajoutez toutes les variables listées ci-dessus"

Write-Host "`n2. 🔑 OBTENIR LA CLÉ OPENAI:"
Write-Host "   - Allez sur https://platform.openai.com/api-keys"
Write-Host "   - Créez une nouvelle clé API"
Write-Host "   - Copiez la clé (format: sk-proj-...)"
Write-Host "   - Ajoutez-la comme OPENAI_API_KEY sur Render"

Write-Host "`n3. 🚀 REDÉPLOYER:"
Write-Host "   - Dans Render, cliquez sur 'Manual Deploy'"
Write-Host "   - Sélectionnez 'Deploy latest commit'"
Write-Host "   - Attendez la fin du build"

Write-Host "`n4. ✅ VÉRIFIER LE DÉPLOIEMENT:"
Write-Host "   - URL de test: https://yukpomnang.onrender.com/healthz"
Write-Host "   - Vérifiez les logs pour les erreurs"
Write-Host "   - Testez l'API avec Postman ou curl"

Write-Host "`n📊 COMMANDES DE TEST:" -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Yellow

Write-Host "`n# Test de santé de l'API:"
Write-Host "curl -X GET https://yukpomnang.onrender.com/healthz"

Write-Host "`n# Test de création d'utilisateur:"
Write-Host "curl -X POST https://yukpomnang.onrender.com/auth/register \"
Write-Host "  -H 'Content-Type: application/json' \"
Write-Host "  -d '{\"email\":\"test@example.com\",\"password\":\"password123\"}'"

Write-Host "`n# Test de connexion:"
Write-Host "curl -X POST https://yukpomnang.onrender.com/auth/login \"
Write-Host "  -H 'Content-Type: application/json' \"
Write-Host "  -d '{\"email\":\"test@example.com\",\"password\":\"password123\"}'"

Write-Host "`n🎯 RÉSULTAT ATTENDU:" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host "✅ Build réussi sans erreurs"
Write-Host "✅ Application démarre sur le port 3001"
Write-Host "✅ Connexion à la base de données établie"
Write-Host "✅ API répond aux requêtes de santé"
Write-Host "✅ Authentification JWT fonctionnelle"
Write-Host "✅ Intégration OpenAI opérationnelle"

Write-Host "`n📞 SUPPORT:" -ForegroundColor Cyan
Write-Host "===========" -ForegroundColor Cyan
Write-Host "Si les problèmes persistent:"
Write-Host "1. Vérifiez les logs détaillés sur Render"
Write-Host "2. Testez localement avec: cargo run"
Write-Host "3. Vérifiez la connectivité à la base de données"
Write-Host "4. Contactez le support Render si nécessaire"

Write-Host "`n✨ Script terminé! Suivez les étapes ci-dessus pour corriger les erreurs Render." -ForegroundColor Green
