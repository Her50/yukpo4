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
