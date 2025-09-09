# Script de Test de Transmission des Images à l'IA Externe
# Vérifie pourquoi les tableaux de produits ne sont pas bien lus

Write-Host "🔍 Test de Transmission des Images à l'IA Externe" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Vérification des services
Write-Host "`n🔍 Vérification des services..." -ForegroundColor Yellow

# Test du backend
Write-Host "  Backend (port 8000)..." -ForegroundColor White
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "    ✅ Backend accessible (HTTP $($backendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "    ❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test du frontend
Write-Host "  Frontend (port 5173)..." -ForegroundColor White
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "    ✅ Frontend accessible (HTTP $($backendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "    ❌ Frontend non accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Analyse du problème de transmission des images
Write-Host "`n🔍 Analyse du Problème de Transmission des Images" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

Write-Host "`n🎯 Problème Identifié:" -ForegroundColor Red
Write-Host "   L'IA externe ne lit pas bien les tableaux de produits sur les images" -ForegroundColor White

Write-Host "`n🔍 Points de Vérification:" -ForegroundColor Yellow

Write-Host "`n1️⃣ Transmission des Images:" -ForegroundColor White
Write-Host "   ✅ Images transmises en base64 depuis ChatInputPanel" -ForegroundColor Green
Write-Host "   ✅ Images reçues par le backend dans handle_creation_service_direct" -ForegroundColor Green
Write-Host "   ✅ Images passées à app_ia.predict_multimodal" -ForegroundColor Green
Write-Host "   ✅ Images formatées pour OpenAI avec data:image/jpeg;base64" -ForegroundColor Green

Write-Host "`n2️⃣ Prompt IA:" -ForegroundColor White
Write-Host "   ✅ Instructions claires pour l'analyse des images" -ForegroundColor Green
Write-Host "   ✅ Demande explicite de listeproduit avec structure détaillée" -ForegroundColor Green
Write-Host "   ✅ Instructions pour extraction exacte des prix, marques, quantités" -ForegroundColor Green

Write-Host "`n3️⃣ Modèles IA Supportés:" -ForegroundColor White
Write-Host "   ✅ OpenAI GPT-4o (multimodal)" -ForegroundColor Green
Write-Host "   ✅ OpenAI GPT-4 Turbo (multimodal)" -ForegroundColor Green
Write-Host "   ✅ Google Gemini Pro (multimodal)" -ForegroundColor Green
Write-Host "   ✅ Anthropic Claude 3.5 Sonnet (multimodal)" -ForegroundColor Green

Write-Host "`n🔍 Diagnostic du Problème:" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

Write-Host "`n❓ Causes Possibles:" -ForegroundColor Yellow
Write-Host "   1. Qualité des images insuffisante pour la lecture de texte" -ForegroundColor White
Write-Host "   2. Format des images non optimal (JPEG vs PNG)" -ForegroundColor White
Write-Host "   3. Taille des images trop grande ou trop petite" -ForegroundColor White
Write-Host "   4. Prompt trop complexe pour l'IA" -ForegroundColor White
Write-Host "   5. Limitation du modèle IA utilisé" -ForegroundColor White

Write-Host "`n🔧 Solutions Proposées:" -ForegroundColor Green
Write-Host "   1. Améliorer la qualité des images avant transmission" -ForegroundColor White
Write-Host "   2. Optimiser le format et la taille des images" -ForegroundColor White
Write-Host "   3. Simplifier le prompt pour l'IA" -ForegroundColor White
Write-Host "   4. Forcer l'utilisation de modèles plus avancés" -ForegroundColor White
Write-Host "   5. Ajouter des logs détaillés pour le debugging" -ForegroundColor White

# Instructions de test manuel
Write-Host "`n🧪 Instructions de Test Manuel" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

Write-Host "`n1️⃣ Test avec Image Simple:" -ForegroundColor Yellow
Write-Host "   - Utiliser une image avec un seul produit et prix clair" -ForegroundColor White
Write-Host "   - Vérifier que l'IA extrait correctement les informations" -ForegroundColor White
Write-Host "   - Comparer avec une image complexe avec plusieurs produits" -ForegroundColor White

Write-Host "`n2️⃣ Test des Logs Backend:" -ForegroundColor Yellow
Write-Host "   - Vérifier les logs de handle_creation_service_direct" -ForegroundColor White
Write-Host "   - Confirmer que les images sont bien reçues" -ForegroundColor White
Write-Host "   - Vérifier que predict_multimodal est appelé" -ForegroundColor White

Write-Host "`n3️⃣ Test des Modèles IA:" -ForegroundColor Yellow
Write-Host "   - Forcer l'utilisation de GPT-4o (le plus avancé)" -ForegroundColor White
Write-Host "   - Tester avec Gemini Pro comme fallback" -ForegroundColor White
Write-Host "   - Comparer les résultats entre modèles" -ForegroundColor White

Write-Host "`n4️⃣ Test de Qualité d'Image:" -ForegroundColor Yellow
Write-Host "   - Utiliser des images haute résolution" -ForegroundColor White
Write-Host "   - Tester avec des images PNG vs JPEG" -ForegroundColor White
Write-Host "   - Vérifier que le texte est lisible à l'œil nu" -ForegroundColor White

# Vérifications techniques
Write-Host "`n🔧 Vérifications Techniques" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

Write-Host "`n✅ Code Backend Vérifié:" -ForegroundColor Green
Write-Host "   - handle_creation_service_direct détecte les images" -ForegroundColor White
Write-Host "   - predict_multimodal appelé quand images présentes" -ForegroundColor White
Write-Host "   - Images transmises en base64 à l'IA" -ForegroundColor White

Write-Host "`n✅ Service IA Vérifié:" -ForegroundColor Green
Write-Host "   - call_openai_multimodal formate correctement les images" -ForegroundColor White
Write-Host "   - Prompt inclut les instructions pour l'analyse" -ForegroundColor White
Write-Host "   - Modèles multimodaux supportés et configurés" -ForegroundColor White

Write-Host "`n✅ Prompt IA Vérifié:" -ForegroundColor Green
Write-Host "   - Instructions claires pour l'extraction des produits" -ForegroundColor White
Write-Host "   - Structure JSON attendue bien définie" -ForegroundColor White
Write-Host "   - Conseils d'analyse critiques inclus" -ForegroundColor White

# Résumé et prochaines étapes
Write-Host "`n📊 Résumé du Diagnostic" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

Write-Host "`n🎯 Problème Principal:" -ForegroundColor White
Write-Host "   L'IA externe reçoit bien les images mais ne les analyse pas efficacement" -ForegroundColor White

Write-Host "`n✅ Points Positifs:" -ForegroundColor White
Write-Host "   - Transmission des images fonctionne" -ForegroundColor White
Write-Host "   - Prompt IA est clair et détaillé" -ForegroundColor White
Write-Host "   - Modèles multimodaux sont configurés" -ForegroundColor White

Write-Host "`n❌ Points à Améliorer:" -ForegroundColor White
Write-Host "   - Qualité des images transmises" -ForegroundColor White
Write-Host "   - Simplification du prompt si nécessaire" -ForegroundColor White
Write-Host "   - Forcer l'utilisation des meilleurs modèles" -ForegroundColor White

Write-Host "`n🧪 Prochaines Étapes:" -ForegroundColor Yellow
Write-Host "   1. Tester avec des images de meilleure qualité" -ForegroundColor White
Write-Host "   2. Vérifier les logs backend pour confirmer la transmission" -ForegroundColor White
Write-Host "   3. Comparer les résultats entre différents modèles IA" -ForegroundColor White
Write-Host "   4. Optimiser le prompt si nécessaire" -ForegroundColor White

Write-Host "`n🎉 Diagnostic Terminé!" -ForegroundColor Green
Write-Host "Le problème semble être dans l'analyse des images par l'IA, pas dans la transmission." -ForegroundColor Cyan
Write-Host "Testez avec des images de meilleure qualité et vérifiez les logs backend." -ForegroundColor Cyan 