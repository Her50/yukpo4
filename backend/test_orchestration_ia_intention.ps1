# test_orchestration_ia_intention.ps1
# Teste la sortie JSON IA pour la création de service et la recherche de besoin (6 cas variés)
# Nécessite : API backend Yukpo démarrée

# Force l'encodage UTF-8 pour éviter les problèmes d'accents et de caractères spéciaux
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://127.0.0.1:3001"

# Authentification (récupère ou crée un utilisateur de test)
$ErrorActionPreference = 'Stop'

# Création automatique d'un utilisateur de test (comme dans test_orchestration_ia.ps1)
$registerBody = @{
    email = "testuser_$(Get-Random)@yukpo.com"
    password = "Test1234!"
    lang = "fr"
}
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    $email = $registerBody.email
    $password = $registerBody.password
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test. Vérifie l'API d'inscription." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
    exit 1
}

# Login pour récupérer le token JWT
$loginBody = @{
    email = $email
    password = $password
}
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "✅ Login réussi. Token récupéré."
} catch {
    Write-Host "❌ Erreur lors du login. Vérifie email/mot de passe et l'API." -ForegroundColor Red
    exit 1
}
$headers = @{
    Authorization = "Bearer $jwtToken"
    "Content-Type" = "application/json; charset=utf-8"
}

# 10 demandes variées et complexes de création de service
$demandes = @(
    # 1. Service de création (on garde un seul exemple)
    "Je veux créer une librairie scolaire avec un tableau de livres et de fournitures fictifs (exemple : livres de maths, romans jeunesse, cahiers, stylos, règles, etc.).",

    # 2. Intention rechercher_besoin (5 cas variés)
    "Je cherche un plombier disponible à Douala pour une urgence fuite d'eau.",
    "Je recherche un manuel de mathématiques pour la classe de 6ème.",
    "Je souhaite trouver un service de livraison de repas végétarien à Yaoundé.",
    "Je cherche une salle de sport ouverte le soir dans le quartier Bonamoussadi.",
    "Je veux trouver un covoiturage pour aller à Kribi ce week-end."
)

for ($i = 0; $i -lt $demandes.Count; $i++) {
    $inputBody = @{ texte = $demandes[$i] }
    $inputJson = $inputBody | ConvertTo-Json -Depth 5
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($inputJson)
    try {
        $respRaw = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Body $utf8Bytes -ContentType 'application/json; charset=utf-8' -Headers $headers -ErrorAction Stop
        $respStr = $respRaw | ConvertTo-Json -Depth 10
        Write-Host "[TEST $($i+1)] Sortie JSON IA : $respStr" -ForegroundColor Cyan
        # Vérification stricte : pas de balises markdown, pas de texte parasite, doit commencer par { et finir par }
        $rawText = $respStr.Trim()
        if ($rawText -match '```' -or $rawText -match 'Voici le JSON' -or -not ($rawText.StartsWith('{') -and $rawText.EndsWith('}'))) {
            Write-Host "❌ Réponse IA non conforme : balises markdown, texte parasite ou non-objet JSON pur" -ForegroundColor Red
        } else {
            Write-Host "✅ Réponse IA conforme (objet JSON pur)" -ForegroundColor Green
        }
        if ($respRaw.intention -ne "creation_service") {
            Write-Host "❌ L'intention n'est pas 'creation_service'" -ForegroundColor Red
        } else {
            Write-Host "✅ Intention correcte : creation_service" -ForegroundColor Green
        }
        foreach ($champ in @("titre", "description", "category")) {
            if (-not $respRaw.PSObject.Properties.Name -contains $champ) {
                Write-Host "❌ Champ '$champ' absent dans la réponse IA" -ForegroundColor Red
            } else {
                Write-Host "✅ Champ '$champ' présent" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "[TEST $($i+1)] Erreur lors de l'appel IA : $_" -ForegroundColor Red
    }
}

# --- TEST BOUT-EN-BOUT : Création d'un service puis recherche besoin qui doit matcher ---

# 1. Création d'un service unique (exemple : librairie YukpoTest)
$serviceTitre = "Librairie YukpoTest $([guid]::NewGuid().ToString().Substring(0,8))"
$serviceBody = @{
    titre = @{ type_donnee = "string"; valeur = $serviceTitre; origine_champs = "test" }
    description = @{ type_donnee = "string"; valeur = "Librairie scolaire test auto avec livres, cahiers, stylos."; origine_champs = "test" }
    category = @{ type_donnee = "string"; valeur = "librairie"; origine_champs = "test" }
    is_tarissable = $false
    intention = "creation_service"
    reponse_intelligente = @{ type_donnee = "string"; valeur = "Service de librairie créé pour test"; origine_champs = "ia" }
    zone_gps = @{ type_donnee = "gps"; valeur = "4.05,9.7"; origine_champs = "test" }
}
$serviceJson = $serviceBody | ConvertTo-Json -Depth 5
try {
    $createResp = Invoke-RestMethod -Uri "$baseUrl/api/services/create" -Method Post -Body $serviceJson -Headers $headers -ErrorAction Stop
    $serviceId = $createResp.service_id
    Write-Host "[TEST SERVICE] ✅ Service de test créé (ID: $serviceId, titre: $serviceTitre)" -ForegroundColor Green
    # Pause pour laisser Pinecone indexer (si asynchrone)
    Start-Sleep -Seconds 5
} catch {
    Write-Host "[TEST SERVICE] ❌ Erreur lors de la création du service de test : $_" -ForegroundColor Red
    exit 1
}

# 2. Recherche besoin qui doit matcher ce service (workflow réel : demande utilisateur -> IA -> recherche)
$demandeRecherche = "Je cherche une librairie scolaire avec des livres et fournitures."
$inputBodyRecherche = @{ texte = $demandeRecherche }
$inputJsonRecherche = $inputBodyRecherche | ConvertTo-Json -Depth 5
$utf8BytesRecherche = [System.Text.Encoding]::UTF8.GetBytes($inputJsonRecherche)

try {
    # 2.1 Appel à l'IA pour structurer ET rechercher le besoin (tout passe par /api/ia/auto)
    $iaResp = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Body $utf8BytesRecherche -ContentType 'application/json; charset=utf-8' -Headers $headers -ErrorAction Stop
    $iaJson = $iaResp | ConvertTo-Json -Depth 10
    Write-Host "[RECHERCHE IA] Sortie JSON IA : $iaJson" -ForegroundColor Cyan
    if ($iaResp.intention -ne "recherche_besoin" -and $iaResp.intention.valeur -ne "recherche_besoin") {
        Write-Host "❌ L'intention IA n'est pas 'recherche_besoin'" -ForegroundColor Red
        exit 2
    }
    $resultats = $iaResp.resultats
    $match = $null
    foreach ($r in $resultats) {
        Write-Host "[MATCH TEST] Résultat trouvé : titre='$($r.data.titre)', score=$($r.score), semantic_score=$($r.semantic_score), interaction_score=$($r.interaction_score)" -ForegroundColor Yellow
        if ($r.data.titre -eq $serviceTitre) { $match = $r }
    }
    if ($null -ne $match) {
        Write-Host "[MATCH TEST] ✅ Le service créé a bien été retrouvé dans la recherche besoin !" -ForegroundColor Green
    } else {
        Write-Host "[MATCH TEST] ❌ Le service créé n'a PAS été retrouvé dans la recherche besoin." -ForegroundColor Red
        Write-Host "Résultats obtenus : $($resultats | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
        exit 2
    }
} catch {
    Write-Host "[MATCH TEST] ❌ Erreur lors du workflow recherche besoin (IA ou recherche) : $_" -ForegroundColor Red
    exit 1
}

# 3. TEST NÉGATIF : recherche avec une catégorie qui ne doit rien matcher
$rechercheBodyNeg = @{
    description = @{ type_donnee = "string"; valeur = "Je cherche une librairie scolaire avec des livres et fournitures."; origine_champs = "test" }
    category = @{ type_donnee = "string"; valeur = "boulangerie"; origine_champs = "test" }
    intention = @{ type_donnee = "string"; valeur = "recherche_besoin" }
    reponse_intelligente = @{ type_donnee = "string"; valeur = "Recherche de boulangerie"; origine_champs = "test" }
}
$rechercheJsonNeg = $rechercheBodyNeg | ConvertTo-Json -Depth 5
$utf8BytesNeg = [System.Text.Encoding]::UTF8.GetBytes($rechercheJsonNeg)
try {
    $rechercheRespNeg = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Body $utf8BytesNeg -ContentType 'application/json; charset=utf-8' -Headers $headers -ErrorAction Stop
    $resultatsNeg = $rechercheRespNeg.resultats
    $matchNeg = $null
    foreach ($r in $resultatsNeg) {
        if ($r.data.titre -eq $serviceTitre) { $matchNeg = $r }
    }
    if ($null -eq $matchNeg) {
        Write-Host "[NEG TEST] ✅ Aucun faux positif : le service de test n'est PAS ressorti pour une catégorie différente." -ForegroundColor Green
    } else {
        Write-Host "[NEG TEST] ❌ Faux positif : le service de test est ressorti alors qu'il ne devrait pas !" -ForegroundColor Red
        exit 3
    }
} catch {
    Write-Host "[NEG TEST] ❌ Erreur lors de la recherche négative : $_" -ForegroundColor Red
    exit 1
}
