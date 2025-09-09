# test_rechercher_besoin.ps1
# Tests PowerShell pour l'API /api/ia/auto (recherche de besoin)

$baseUrl = "http://localhost:3000"
$jwtToken = "VOTRE_JWT_ICI" # Remplacer par un token valide si besoin

function Assert-Api {
    param(
        [Parameter(Mandatory)]$Body,
        [Parameter(Mandatory)]$ExpectedStatus,
        [Parameter(Mandatory)]$TestName,
        [Parameter()]$ShouldContain
    )
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Headers @{ Authorization = "Bearer $jwtToken" } -Body ($Body | ConvertTo-Json -Depth 10) -ContentType "application/json" -ErrorAction Stop
        if ($ExpectedStatus -eq 200 -or $ExpectedStatus -eq 201) {
            Write-Host "✅ $TestName : OK ($ExpectedStatus)"
            if ($ShouldContain) {
                $json = $response | ConvertTo-Json -Depth 10
                if ($json -notmatch $ShouldContain) {
                    Write-Host "❌ $TestName : Le champ attendu '$ShouldContain' est absent !" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "❌ $TestName : Attendu $ExpectedStatus mais reçu succès" -ForegroundColor Red
        }
    } catch {
        $err = $_.Exception.Response.GetResponseStream() | % { $_.ReadToEnd() }
        if ($err -match $ShouldContain) {
            Write-Host "✅ $TestName : Erreur attendue détectée ($ExpectedStatus)"
        } else {
            Write-Host "❌ $TestName : Erreur inattendue : $err" -ForegroundColor Red
        }
    }
}

# 1. Erreur si reponse_intelligente manquant
$besoin1 = @{ description = "Recherche sans reponse_intelligente"; category = "test" }
Assert-Api $besoin1 400 "Erreur si reponse_intelligente manquant" "reponse_intelligente"

# 2. Erreur si reponse_intelligente vide
$besoin2 = @{ description = "Recherche avec reponse_intelligente vide"; category = "test"; reponse_intelligente = "   " }
Assert-Api $besoin2 400 "Erreur si reponse_intelligente vide" "reponse_intelligente"

# 3. Succès si reponse_intelligente présent
$besoin3 = @{ description = "Recherche valide avec reponse_intelligente"; category = "test"; reponse_intelligente = "Réponse IA pertinente." }
Assert-Api $besoin3 200 "Succès si reponse_intelligente présent" "reponse_intelligente"

# 4. Succès avec GPS (aucun embedding sur GPS)
$besoin4 = @{ description = "Recherche avec GPS point"; category = "geo"; reponse_intelligente = "Test GPS."; gps = @(5.392, -4.008) }
Assert-Api $besoin4 200 "Succès avec GPS (pas d'embedding sur GPS)" "reponse_intelligente"

# 5. Succès avec zone_gps (vérifie zone_gps_utilisee et nombre_matchings)
$besoin5 = @{ description = "Recherche zone circulaire"; category = "geo"; reponse_intelligente = "Test zone_gps."; zone_gps = @{ centre = @(5.392, -4.008); rayon = 10000 } }
Assert-Api $besoin5 200 "Succès avec zone_gps_utilisee et nombre_matchings" "zone_gps_utilisee"

# Test recherche besoin : JSON non pur
$besoin1 = "Ceci n'est pas un JSON"
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Headers @{ Authorization = "Bearer $jwtToken" } -Body $besoin1 -ContentType "application/json"
    Write-Host "❌ Erreur attendue non détectée (JSON non pur)" -ForegroundColor Red
    $global:TestFailures += "Erreur attendue non détectée (JSON non pur)"
} catch {
    Write-Host "✅ Erreur détectée pour JSON non pur (OK)"
}

# Test recherche besoin : dropdown sans options
$besoin2 = @{ description = "Test"; category = "test"; reponse_intelligente = "ok"; choix = "A"; choix_type = "dropdown" }
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Headers @{ Authorization = "Bearer $jwtToken" } -Body ($besoin2 | ConvertTo-Json) -ContentType "application/json"
    Write-Host "❌ Erreur attendue non détectée (dropdown sans options)" -ForegroundColor Red
    $global:TestFailures += "Erreur attendue non détectée (dropdown sans options)"
} catch {
    Write-Host "✅ Erreur détectée pour dropdown sans options (OK)"
}
