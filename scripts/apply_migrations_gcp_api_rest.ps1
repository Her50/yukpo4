# Script pour appliquer les migrations via API REST Cloud SQL Admin

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application des Migrations via API REST Cloud SQL" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Lire le fichier SQL
$sqlFile = "backend\migrations\20260218_ALL_OPTIMIZATIONS_COMBINED.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
Write-Host "Fichier SQL lu: $sqlFile" -ForegroundColor Green
Write-Host "Taille: $($sqlContent.Length) caracteres" -ForegroundColor Gray
Write-Host ""

# Diviser le SQL en requêtes individuelles (séparées par ;)
# Mais attention: les blocs DO $$ ... END $$ doivent rester ensemble
$queries = @()
$currentQuery = ""
$inDoBlock = $false
$doBlockDepth = 0

$lines = $sqlContent -split "`n"
foreach ($line in $lines) {
    $trimmed = $line.Trim()
    
    if ($trimmed -match "^\s*DO\s+\$\$") {
        $inDoBlock = $true
        $doBlockDepth = 1
        $currentQuery += $line + "`n"
    } elseif ($inDoBlock) {
        $currentQuery += $line + "`n"
        if ($trimmed -match "END\s+\$\$;") {
            $doBlockDepth--
            if ($doBlockDepth -eq 0) {
                $inDoBlock = $false
                $queries += $currentQuery.Trim()
                $currentQuery = ""
            }
        } elseif ($trimmed -match "DO\s+\$\$") {
            $doBlockDepth++
        }
    } elseif ($trimmed -match "^--" -or [string]::IsNullOrWhiteSpace($trimmed)) {
        # Commentaire ou ligne vide, continuer
        continue
    } elseif ($trimmed.EndsWith(";")) {
        $currentQuery += $line + "`n"
        if ($currentQuery.Trim() -ne "") {
            $queries += $currentQuery.Trim()
            $currentQuery = ""
        }
    } else {
        $currentQuery += $line + "`n"
    }
}

if ($currentQuery.Trim() -ne "") {
    $queries += $currentQuery.Trim()
}

Write-Host "Nombre de requetes SQL identifiees: $($queries.Count)" -ForegroundColor Cyan
Write-Host ""

# Obtenir un token d'accès
Write-Host "Obtention du token d'acces..." -ForegroundColor Yellow
$accessToken = gcloud auth print-access-token --project=$ProjectId 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible d'obtenir le token d'acces" -ForegroundColor Red
    exit 1
}

Write-Host "Token obtenu" -ForegroundColor Green
Write-Host ""

# Appliquer chaque requête via l'API REST
$apiUrl = "https://sqladmin.googleapis.com/v1/projects/$ProjectId/instances/$InstanceName/databases/$DatabaseName"

Write-Host "Application des migrations via API REST..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($query in $queries) {
    if ([string]::IsNullOrWhiteSpace($query)) {
        continue
    }
    
    # Extraire le nom de la requête (première ligne de commentaire ou CREATE INDEX)
    $queryName = "Migration"
    if ($query -match "CREATE INDEX.*?(\w+)") {
        $queryName = $matches[1]
    } elseif ($query -match "-- Migration.*?(\w+)") {
        $queryName = $matches[1]
    }
    
    Write-Host "  Application: $queryName..." -ForegroundColor Gray
    
    # Encoder le SQL en base64
    $queryBytes = [System.Text.Encoding]::UTF8.GetBytes($query)
    $queryBase64 = [Convert]::ToBase64String($queryBytes)
    
    # Créer le body JSON
    $body = @{
        kind = "sql#queryRequest"
        query = $query
    } | ConvertTo-Json -Depth 10
    
    # Appeler l'API REST
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$apiUrl/query" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        if ($response.kind -eq "sql#queryResponse") {
            Write-Host "    OK: $queryName" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "    ATTENTION: Reponse inattendue" -ForegroundColor Yellow
            $successCount++
        }
    } catch {
        $errorMessage = $_.Exception.Message
        # Vérifier si c'est une erreur "already exists" (non bloquant)
        if ($errorMessage -match "already exists|existe déjà|duplicate|relation.*already exists") {
            Write-Host "    INFO: $queryName - Deja appliquee" -ForegroundColor Yellow
            $successCount++
        } else {
            Write-Host "    ERREUR: $queryName" -ForegroundColor Red
            Write-Host "    Message: $errorMessage" -ForegroundColor Gray
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Resume: $successCount reussie(s), $errorCount erreur(s)" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

if ($errorCount -eq 0) {
    Write-Host "OK Toutes les migrations ont ete appliquees avec succes!" -ForegroundColor Green
} else {
    Write-Host "ATTENTION: Certaines migrations ont echoue. Verifiez les erreurs ci-dessus." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Application manuelle via Console Cloud SQL" -ForegroundColor Yellow
    Write-Host "1. Ouvrez: https://console.cloud.google.com/sql/instances/$InstanceName/databases" -ForegroundColor Cyan
    Write-Host "2. Cliquez sur '$DatabaseName' puis 'Query'" -ForegroundColor Cyan
    Write-Host "3. Copiez-collez le contenu de: $sqlFile" -ForegroundColor Cyan
}


