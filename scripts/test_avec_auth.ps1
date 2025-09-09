# Test avec authentification automatique
# Ce script genere d'abord un token JWT valide puis lance les tests

Write-Host "TEST AVEC AUTHENTIFICATION AUTOMATIQUE" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Configuration
$BACKEND_API_URL = "http://localhost:3001"

# Etape 1: Generer un token JWT via login
Write-Host "`nEtape 1: Generation du token JWT..." -ForegroundColor Yellow

$loginPayload = @{
    email = "lelehernandez2007@yahoo.fr"
    password = "votre_mot_de_passe_ici"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Tentative de connexion..." -ForegroundColor Gray
    $loginResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/auth/login" -Method POST -Headers @{"Content-Type" = "application/json"} -Body $loginPayload -TimeoutSec 30
    
    if ($loginResponse.token) {
        $JWT_TOKEN = $loginResponse.token
        Write-Host "Token JWT genere avec succes!" -ForegroundColor Green
        Write-Host "Token: $($JWT_TOKEN.Substring(0, 50))..." -ForegroundColor Cyan
    } else {
        Write-Host "Erreur: Pas de token dans la reponse" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Erreur de connexion: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifiez vos identifiants ou la configuration de la base de donnees" -ForegroundColor Yellow
    exit 1
}

# Configuration des headers avec le nouveau token
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT_TOKEN"
}

# Etape 2: Test de creation de service
Write-Host "`nEtape 2: Test de creation de service mecanicien" -ForegroundColor Yellow

$createPayload = @{
    user_input = "Je cherche un mecanicien pour reparer ma voiture"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de creation..." -ForegroundColor Gray
    $createResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload -TimeoutSec 60
    
    Write-Host "Service cree avec succes!" -ForegroundColor Green
    Write-Host "Intention detectee: $($createResponse.intention)" -ForegroundColor White
    Write-Host "Titre: $($createResponse.titre.valeur)" -ForegroundColor White
    Write-Host "Categorie: $($createResponse.category.valeur)" -ForegroundColor White
    Write-Host "Tokens consommes: $($createResponse.tokens_consumed)" -ForegroundColor Cyan
    
    if ($createResponse.description) {
        Write-Host "Description: $($createResponse.description.valeur)" -ForegroundColor White
    }
    
} catch {
    Write-Host "Erreur creation service: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Details: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
}

# Pause pour la synchronisation des embeddings
Write-Host "`nPause de 15 secondes pour la synchronisation des embeddings..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Etape 3: Test de recherche
Write-Host "`nEtape 3: Test de recherche de mecanicien" -ForegroundColor Yellow

$searchPayload = @{
    user_input = "Je cherche un mecanicien"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de recherche..." -ForegroundColor Gray
    $startTime = Get-Date
    $searchResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $searchPayload -TimeoutSec 60
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "Recherche reussie!" -ForegroundColor Green
    Write-Host "Intention detectee: $($searchResponse.intention)" -ForegroundColor White
    Write-Host "Temps de reponse: ${duration}ms" -ForegroundColor Cyan
    Write-Host "Modele IA utilise: $($searchResponse.ia_model_used)" -ForegroundColor White
    Write-Host "Tokens consommes: $($searchResponse.tokens_consumed)" -ForegroundColor Yellow
    
    if ($searchResponse.resultats) {
        Write-Host "Resultats: $($searchResponse.resultats.detail)" -ForegroundColor White
    }
    
    if ($searchResponse.reponse_intelligente) {
        Write-Host "Reponse IA: $($searchResponse.reponse_intelligente.valeur)" -ForegroundColor White
    }
    
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Details: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
}

# Etape 4: Test de creation d'un autre service
Write-Host "`nEtape 4: Test de creation de service plombier" -ForegroundColor Yellow

$createPayload2 = @{
    user_input = "J'ai besoin d'un plombier pour reparer une fuite d'eau urgente"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de creation..." -ForegroundColor Gray
    $createResponse2 = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload2 -TimeoutSec 60
    
    Write-Host "Service plombier cree avec succes!" -ForegroundColor Green
    Write-Host "Intention detectee: $($createResponse2.intention)" -ForegroundColor White
    Write-Host "Titre: $($createResponse2.titre.valeur)" -ForegroundColor White
    Write-Host "Categorie: $($createResponse2.category.valeur)" -ForegroundColor White
    Write-Host "Tokens consommes: $($createResponse2.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "Erreur creation service plombier: $($_.Exception.Message)" -ForegroundColor Red
}

# Pause pour la synchronisation
Write-Host "`nPause de 15 secondes pour la synchronisation..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Etape 5: Test de recherche de plombier
Write-Host "`nEtape 5: Test de recherche de plombier" -ForegroundColor Yellow

$searchPayload2 = @{
    user_input = "Je cherche un plombier urgent"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de recherche..." -ForegroundColor Gray
    $startTime = Get-Date
    $searchResponse2 = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $searchPayload2 -TimeoutSec 60
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "Recherche plombier reussie!" -ForegroundColor Green
    Write-Host "Intention detectee: $($searchResponse2.intention)" -ForegroundColor White
    Write-Host "Temps de reponse: ${duration}ms" -ForegroundColor Cyan
    Write-Host "Modele IA utilise: $($searchResponse2.ia_model_used)" -ForegroundColor White
    Write-Host "Tokens consommes: $($searchResponse2.tokens_consumed)" -ForegroundColor Yellow
    
    if ($searchResponse2.resultats) {
        Write-Host "Resultats: $($searchResponse2.resultats.detail)" -ForegroundColor White
    }
    
} catch {
    Write-Host "Erreur recherche plombier: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest avec authentification termine!" -ForegroundColor Green
Write-Host "Verifiez les resultats ci-dessus" -ForegroundColor White 