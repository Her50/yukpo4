# test_programme_scolaire.ps1 — Tests PowerShell pour l’API de validation des programmes scolaires Yukpo
# Nécessite : PowerShell 5+, module Invoke-RestMethod, API Yukpo démarrée

$apiBase = "http://localhost:3001"

# Authentification (réutilise le token de test si possible)
$jwt = $env:YUKPO_JWT_TOKEN
if (-not $jwt) {
    try { $jwt = Get-Content -Path "token_test.txt" -Raw } catch {}
}
if (-not $jwt) {
    Write-Host "Aucun token JWT trouvé. Veuillez lancer test_echanges.ps1 d'abord pour générer un utilisateur de test." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwt" }

function Test-ValidProgrammeScolaire {
    Write-Host "Test: Création d’un programme scolaire valide..." -ForegroundColor Cyan
    $body = @{
        intention = "programme_scolaire"
        classe = "6e"
        annee = 2025
        etablissement = "Collège Demo"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; matiere = "Mathématiques" })
    } | ConvertTo-Json -Depth 5
    $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction SilentlyContinue
    if ($resp -and !$resp.error) {
        Write-Host "OK: Programme scolaire accepté (valide)" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Programme scolaire valide rejeté !" -ForegroundColor Red
    }
}

function Test-InvalidProgrammeScolaire {
    Write-Host "Test: Création d’un programme scolaire invalide (année hors plage)..." -ForegroundColor Cyan
    $body = @{
        intention = "programme_scolaire"
        classe = "6e"
        annee = 1999
        etablissement = "Collège Demo"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; matiere = "Mathématiques" })
    } | ConvertTo-Json -Depth 5
    $resp = $null
    $errMsg = $null
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            try { $errMsg = $_.Exception.Response.GetResponseStream() | % { $reader = New-Object IO.StreamReader($_); $reader.ReadToEnd() } | ConvertFrom-Json } catch {}
        }
    }
    if ($errMsg) {
        Write-Host "OK: Programme scolaire invalide rejeté (erreur attendue) : $($errMsg | ConvertTo-Json -Depth 5)" -ForegroundColor Green
    } elseif ($resp -and $resp.error) {
        Write-Host "OK: Programme scolaire invalide rejeté (erreur attendue, champ error)" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Programme scolaire invalide accepté !" -ForegroundColor Red
    }
}

function Test-InvalidProgrammeScolaireListe {
    Write-Host "Test: Création d’un programme scolaire invalide (listeproduit vide)..." -ForegroundColor Cyan
    $body = @{
        intention = "programme_scolaire"
        classe = "6e"
        annee = 2025
        etablissement = "Collège Demo"
        listeproduit = @()
    } | ConvertTo-Json -Depth 5
    $resp = $null
    $errMsg = $null
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            try { $errMsg = $_.Exception.Response.GetResponseStream() | % { $reader = New-Object IO.StreamReader($_); $reader.ReadToEnd() } | ConvertFrom-Json } catch {}
        }
    }
    if ($errMsg) {
        Write-Host "OK: Programme scolaire invalide rejeté (erreur attendue) : $($errMsg | ConvertTo-Json -Depth 5)" -ForegroundColor Green
    } elseif ($resp -and $resp.error) {
        Write-Host "OK: Programme scolaire invalide rejeté (erreur attendue, champ error)" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Programme scolaire invalide accepté !" -ForegroundColor Red
    }
}

Test-ValidProgrammeScolaire
Test-InvalidProgrammeScolaire
Test-InvalidProgrammeScolaireListe
