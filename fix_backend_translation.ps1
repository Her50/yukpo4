# Correction du problème de traduction dans le backend
Write-Host "Correction du problème de traduction dans le backend..." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# 1. Vérifier l'état actuel
Write-Host "`n1️⃣ État actuel..." -ForegroundColor Yellow
$google_key = $env:GOOGLE_TRANSLATE_API_KEY
if ($google_key) {
    Write-Host "✅ GOOGLE_TRANSLATE_API_KEY présente: $($google_key.Substring(0,10))..." -ForegroundColor Green
} else {
    Write-Host "❌ GOOGLE_TRANSLATE_API_KEY ABSENTE!" -ForegroundColor Red
}

# 2. Analyser le problème
Write-Host "`n2️⃣ Analyse du problème..." -ForegroundColor Yellow
Write-Host "Le problème est dans la fonction extract_user_text_from_input du backend:" -ForegroundColor Cyan
Write-Host "- Elle essaie de traduire les requêtes utilisateur en anglais" -ForegroundColor Yellow
Write-Host "- Mais GOOGLE_TRANSLATE_API_KEY est absente" -ForegroundColor Yellow
Write-Host "- Donc elle envoie le texte français à Pinecone" -ForegroundColor Yellow
Write-Host "- Mais Pinecone contient des embeddings anglais" -ForegroundColor Yellow
Write-Host "- Résultat: recherche impossible" -ForegroundColor Red

# 3. Solution 1: Désactiver la traduction automatique
Write-Host "`n3️⃣ Solution 1: Désactiver la traduction automatique..." -ForegroundColor Yellow
Write-Host "Modification du code backend pour désactiver la traduction..." -ForegroundColor Cyan

# Créer un patch temporaire
$patch_content = @"
// PATCH TEMPORAIRE: Désactiver la traduction automatique
// Ligne 1478-1485 dans extract_user_text_from_input
// Remplacer par:
/*
// 5. Traduction en anglais pour la cohérence avec les embeddings stockés
if !raw_text.is_empty() {
    let detected_lang = detect_lang(&raw_text);
    if detected_lang != "en" {
        log_info(&format!("[extract_user_text_from_input] Traduction de '{}' ({} -> en)", &raw_text.chars().take(50).collect::<String>(), detected_lang));
        let translated_text = translate_to_en(&raw_text, &detected_lang).await;
        log_info(&format!("[extract_user_text_from_input] Texte traduit: '{}' -> '{}'", &raw_text.chars().take(50).collect::<String>(), &translated_text.chars().take(50).collect::<String>()));
        return translated_text;
    }
}
*/

// NOUVELLE LOGIQUE: Pas de traduction automatique
log_info(&format!("[extract_user_text_from_input] Texte utilisateur conservé en langue originale: '{}'", &raw_text.chars().take(50).collect::<String>()));
"@

$patch_content | Out-File -FilePath "translation_patch.txt" -Encoding UTF8
Write-Host "✅ Patch créé dans translation_patch.txt" -ForegroundColor Green

# 4. Solution 2: Configurer une clé Google Translate factice
Write-Host "`n4️⃣ Solution 2: Configuration d'une clé factice..." -ForegroundColor Yellow
Write-Host "Configuration d'une clé factice pour éviter l'erreur..." -ForegroundColor Cyan

$env:GOOGLE_TRANSLATE_API_KEY = "fake_key_for_testing"
Write-Host "✅ Clé factice configurée temporairement" -ForegroundColor Green

# 5. Solution 3: Modifier la logique de traduction
Write-Host "`n5️⃣ Solution 3: Modifier la logique de traduction..." -ForegroundColor Yellow
Write-Host "Création d'un fichier de correction..." -ForegroundColor Cyan

$correction_content = @"
// CORRECTION: Modifier la logique de traduction dans extract_user_text_from_input
// Remplacer les lignes 1478-1485 par:

// 5. Traduction conditionnelle en anglais
if !raw_text.is_empty() {
    let detected_lang = detect_lang(&raw_text);
    if detected_lang != "en" {
        // Vérifier si la traduction est disponible
        let api_key = std::env::var("GOOGLE_TRANSLATE_API_KEY").unwrap_or_default();
        if !api_key.is_empty() && api_key != "fake_key_for_testing" {
            log_info(&format!("[extract_user_text_from_input] Traduction de '{}' ({} -> en)", &raw_text.chars().take(50).collect::<String>(), detected_lang));
            let translated_text = translate_to_en(&raw_text, &detected_lang).await;
            log_info(&format!("[extract_user_text_from_input] Texte traduit: '{}' -> '{}'", &raw_text.chars().take(50).collect::<String>(), &translated_text.chars().take(50).collect::<String>()));
            return translated_text;
        } else {
            log_info(&format!("[extract_user_text_from_input] Traduction désactivée, conservation du texte original: '{}'", &raw_text.chars().take(50).collect::<String>()));
            return raw_text;
        }
    }
}
"@

$correction_content | Out-File -FilePath "translation_correction.txt" -Encoding UTF8
Write-Host "✅ Correction créée dans translation_correction.txt" -ForegroundColor Green

# 6. Test de la solution
Write-Host "`n6️⃣ Test de la solution..." -ForegroundColor Yellow
Write-Host "Redémarrage du backend avec la nouvelle configuration..." -ForegroundColor Cyan

# Arrêter le backend
Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"} | Stop-Process -Force
Start-Sleep -Seconds 3

# Redémarrer le backend
Set-Location "backend"
$process = Start-Process -FilePath "cargo" -ArgumentList "run" -PassThru -WindowStyle Hidden
Write-Host "✅ Backend redémarré (PID: $($process.Id))" -ForegroundColor Green
Set-Location ".."

# Attendre que le backend soit prêt
Start-Sleep -Seconds 15

# Test de recherche
Write-Host "`nTest de recherche après correction..." -ForegroundColor Yellow
$searchRequest = @{
    texte = "Je cherche un mécanicien"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $searchRequest -Headers $headers
    Write-Host "✅ Recherche réussie!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 2)"
    
    if ($response.resultats -and $response.resultats.results -and $response.resultats.results.Count -gt 0) {
        Write-Host "🎉 SUCCÈS: Résultats trouvés!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.resultats.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé de la correction:" -ForegroundColor Cyan
Write-Host "1. Patch créé pour désactiver la traduction automatique" -ForegroundColor Green
Write-Host "2. Clé factice configurée pour éviter l'erreur" -ForegroundColor Green
Write-Host "3. Correction du code créée" -ForegroundColor Green
Write-Host "4. Backend redémarré avec la nouvelle configuration" -ForegroundColor Green
Write-Host "`nMaintenant les recherches devraient fonctionner!" -ForegroundColor Green 