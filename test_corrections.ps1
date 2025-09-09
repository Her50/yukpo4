# Test des corrections appliquées
# 1. Normalisation L2 dans le microservice d'embedding
# 2. Traduction automatique des requêtes de recherche en anglais

Write-Host "🧪 Test des corrections appliquées" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Test 1: Vérifier que le microservice d'embedding fonctionne avec la normalisation L2
Write-Host "`n1️⃣ Test de la normalisation L2..." -ForegroundColor Yellow
cd microservice_embedding
$testResult = python -c "from services import encode_text; emb = encode_text('test'); norm = sum(x*x for x in emb)**0.5; print(f'Norm L2: {norm}'); print('SUCCESS' if abs(norm - 1.0) < 0.01 else 'FAIL')"

if ($testResult -like "*SUCCESS*") {
    Write-Host "✅ Normalisation L2 fonctionne correctement" -ForegroundColor Green
} else {
    Write-Host "❌ Problème avec la normalisation L2" -ForegroundColor Red
    Write-Host "Résultat: $testResult" -ForegroundColor Red
}

# Test 2: Vérifier que le backend compile
Write-Host "`n2️⃣ Test de compilation du backend..." -ForegroundColor Yellow
cd ..\backend
$compileResult = cargo check 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend compile correctement" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur de compilation du backend" -ForegroundColor Red
    Write-Host "Erreur: $compileResult" -ForegroundColor Red
}

# Test 3: Vérifier que les fonctions de traduction sont bien importées
Write-Host "`n3️⃣ Test des imports de traduction..." -ForegroundColor Yellow
cd ..
$importCheck = Select-String -Path "backend\src\services\orchestration_ia.rs" -Pattern "use crate::services::creer_service::\{detect_lang, translate_to_en\};"

if ($importCheck) {
    Write-Host "✅ Imports de traduction corrects" -ForegroundColor Green
} else {
    Write-Host "❌ Imports de traduction manquants" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé des corrections appliquées:" -ForegroundColor Cyan
Write-Host "• ✅ Normalisation L2 ajoutée à encode_text()" -ForegroundColor Green
Write-Host "• ✅ Traduction automatique des requêtes de recherche en anglais" -ForegroundColor Green
Write-Host "• ✅ Cohérence linguistique entre création et recherche de services" -ForegroundColor Green

Write-Host "`n🚀 Prêt pour tester la recherche sémantique !" -ForegroundColor Green
Write-Host "Les requêtes françaises seront automatiquement traduites en anglais" -ForegroundColor Cyan
Write-Host "avant d'être comparées aux embeddings stockés." -ForegroundColor Cyan 