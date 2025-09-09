# test_orchestration_ia_end_to_end.ps1
# Test end-to-end Yukpo : workflow utilisateur réel (un POST sur l'orchestrateur IA)
# Log détaillé à chaque étape et mesure du temps d'orchestration

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# 0. Création automatique d'un utilisateur de test
$email = "testuser_$(Get-Random)@yukpo.com"
$password = "Test1234!"
$registerBody = @{ email = $email; password = $password; lang = "fr" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test." -ForegroundColor Red
    exit 1
}

# 1. Login pour récupérer le token
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "[OK] Connexion réussie, token récupéré."
} catch {
    Write-Host "❌ Erreur lors du login utilisateur." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwtToken"; "Content-Type" = "application/json; charset=utf-8" }

function Get-TokenCount {
    param(
        [string]$Text
    )
    # Découpe sur les espaces, ponctuation simple, etc. (approximation)
    $tokens = $Text -split '\s+' | Where-Object { $_ -ne '' }
    return $tokens.Count
}

# 1. Création d'un service complexe cohérent (ex : organisation d'événement d'entreprise)
$texteLibreServiceSimple = "Je souhaite créer un service d'organisation d'événements d'entreprise : gestion de séminaires, conférences, logistique, restauration, équipements audiovisuels, réservation de salle, animation, etc."
$tokenCount = Get-TokenCount $texteLibreServiceSimple
Write-Host "[INFO] Nombre de tokens (entrée utilisateur) : $tokenCount"
# Harmonisation : on envoie le texte dans les deux champs
$bodyServiceSimple = @{ texte = $texteLibreServiceSimple; texte_libre = $texteLibreServiceSimple }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (création service complexe organisation événement)"
$startTime = Get-Date
try {
    $responseServiceSimple = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyServiceSimple | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (création service complexe) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (service complexe) : $($responseServiceSimple | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "❌ Erreur lors de l'orchestration IA (création service complexe)." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
}

# 2. Besoin très similaire (service complexe)
$texteBesoinSimple1 = "Je cherche une société pour organiser un séminaire d'entreprise avec gestion de la logistique, réservation de salle et équipements audiovisuels."
$tokenCount = Get-TokenCount $texteBesoinSimple1
Write-Host "[INFO] Nombre de tokens (entrée utilisateur) : $tokenCount"
$bodyBesoinSimple1 = @{ texte = $texteBesoinSimple1 }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (besoin très similaire, service complexe)"
$startTime = Get-Date
try {
    $responseBesoinSimple1 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyBesoinSimple1 | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (besoin très similaire, service complexe) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (besoin très similaire, service complexe) : $($responseBesoinSimple1 | ConvertTo-Json -Depth 10)"
    if ($responseBesoinSimple1.resultats.Count -gt 0) {
        Write-Host "[OK] Matching positif (très similaire, service complexe) :"
        foreach ($r in $responseBesoinSimple1.resultats) {
            $score = if ($r.PSObject.Properties["score"]) { $r.score } else { "<N/A>" }
            $titre = if ($r.data -and $r.data.titre -and $r.data.titre.valeur) { $r.data.titre.valeur } else { "<N/A>" }
            Write-Host ("- ServiceID: {0} | Score: {1} | Titre: {2}" -f $r.service_id, $score, $titre)
        }
    } else {
        Write-Host "[KO] Aucun service matché (alors qu'un match était attendu, service complexe)."
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche besoin (très similaire, service complexe)." -ForegroundColor Red
}

# 3. Besoin moyennement similaire (service complexe)
$texteBesoinSimple2 = "Je voudrais un traiteur pour un événement professionnel avec service sur place et animation."
$tokenCount = Get-TokenCount $texteBesoinSimple2
Write-Host "[INFO] Nombre de tokens (entrée utilisateur) : $tokenCount"
$bodyBesoinSimple2 = @{ texte = $texteBesoinSimple2 }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (besoin moyennement similaire, service complexe)"
$startTime = Get-Date
try {
    $responseBesoinSimple2 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyBesoinSimple2 | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (besoin moyennement similaire, service complexe) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (besoin moyennement similaire, service complexe) : $($responseBesoinSimple2 | ConvertTo-Json -Depth 10)"
    if ($responseBesoinSimple2.resultats.Count -gt 0) {
        Write-Host "[OK] Matching positif (moyennement similaire, service complexe) :"
        foreach ($r in $responseBesoinSimple2.resultats) {
            $score = if ($r.PSObject.Properties["score"]) { $r.score } else { "<N/A>" }
            $titre = if ($r.data -and $r.data.titre -and $r.data.titre.valeur) { $r.data.titre.valeur } else { "<N/A>" }
            Write-Host ("- ServiceID: {0} | Score: {1} | Titre: {2}" -f $r.service_id, $score, $titre)
        }
    } else {
        Write-Host "[KO] Aucun service matché (alors qu'un match était possible, service complexe)."
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche besoin (moyennement similaire, service complexe)." -ForegroundColor Red
}

# 4. Besoin non similaire (service complexe)
$texteBesoinSimple3 = "Je cherche un coach sportif pour des séances de remise en forme en entreprise."
$tokenCount = Get-TokenCount $texteBesoinSimple3
Write-Host "[INFO] Nombre de tokens (entrée utilisateur) : $tokenCount"
$bodyBesoinSimple3 = @{ texte = $texteBesoinSimple3 }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (besoin non similaire, service complexe)"
$startTime = Get-Date
try {
    $responseBesoinSimple3 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyBesoinSimple3 | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (besoin non similaire, service complexe) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (besoin non similaire, service complexe) : $($responseBesoinSimple3 | ConvertTo-Json -Depth 10)"
    if ($responseBesoinSimple3.resultats.Count -eq 0) {
        Write-Host "[OK] Aucun service matché (attendu pour un besoin non similaire, service complexe)."
    } else {
        Write-Host "[KO] Matching inattendu sur un besoin non similaire (service complexe) !"
        foreach ($r in $responseBesoinSimple3.resultats) {
            $score = if ($r.PSObject.Properties["score"]) { $r.score } else { "<N/A>" }
            $titre = if ($r.data -and $r.data.titre -and $r.data.titre.valeur) { $r.data.titre.valeur } else { "<N/A>" }
            Write-Host ("- ServiceID: {0} | Score: {1} | Titre: {2}" -f $r.service_id, $score, $titre)
        }
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche besoin (non similaire, service complexe)." -ForegroundColor Red
}

# TEST INTENTION ASSISTANCE GENERALE
$texteAssistance = "Comment fonctionne la plateforme Yukpo pour les utilisateurs ?"
$tokenCount = Get-TokenCount $texteAssistance
Write-Host "[INFO] Nombre de tokens (entrée utilisateur, assistance) : $tokenCount"
$bodyAssistance = @{ texte = $texteAssistance }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (intention assistance_generale)"
$startTime = Get-Date
try {
    $responseAssistance = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyAssistance | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (assistance_generale) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (assistance_generale) : $($responseAssistance | ConvertTo-Json -Depth 10)"
    if ($responseAssistance.intention -eq "assistance_generale" -or $responseAssistance.data.intention.valeur -eq "assistance_generale") {
        Write-Host "[OK] Intention assistance_generale détectée."
    } else {
        Write-Host "[KO] L'intention détectée n'est pas assistance_generale !"
    }
} catch {
    Write-Host "❌ Erreur lors de l'orchestration IA (assistance_generale)." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
}

