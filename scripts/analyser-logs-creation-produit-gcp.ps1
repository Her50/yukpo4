# Script pour analyser les logs backend GCP liés à la création de produit et erreurs OpenAI
# Usage: .\scripts\analyser-logs-creation-produit-gcp.ps1 [-Hours 24]

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpServiceName = "yukpo-backend",
    [int]$Hours = 24,
    [int]$Limit = 500
)

Write-Host ""
Write-Host "🔍 ANALYSE DES LOGS - CRÉATION PRODUIT et OPENAI" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host "Période: $Hours dernières heures" -ForegroundColor Yellow
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

# Requête pour les logs de création de produit
$query = "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName"

Write-Host "📥 Récupération des logs..." -ForegroundColor Yellow
$allLogs = gcloud logging read $query --limit=$Limit --project=$GcpProjectId --format=json --freshness="${Hours}h" 2>&1 | ConvertFrom-Json

if (-not $allLogs -or $allLogs.Count -eq 0) {
    Write-Host "⚠️  Aucun log trouvé pour la période spécifiée" -ForegroundColor Yellow
    exit 0
}

Write-Host "✅ $($allLogs.Count) logs récupérés" -ForegroundColor Green
Write-Host ""

# ============================================================================
# FILTRES POUR CRÉATION DE PRODUIT
# ============================================================================
Write-Host "1️⃣  LOGS DE CRÉATION DE PRODUIT" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$productCreationLogs = $allLogs | Where-Object {
    $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
    $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Depth 10) } else { "" }
    $combined = "$textPayload $jsonPayload".ToLower()
    
    $combined -like '*creer_service*' -or
    $combined -like '*create_product*' -or
    $combined -like '*process_product*' -or
    $combined -like '*creation produit*' -or
    $combined -like '*product creation*' -or
    $combined -like '*services/*/products*' -or
    $combined -like '*produit créé*' -or
    $combined -like '*produit créé*' -or
    $combined -like '*product created*' -or
    $combined -like '*product_data*' -or
    $combined -like '*service_products*'
}

if ($productCreationLogs) {
    Write-Host "   ✅ $($productCreationLogs.Count) log(s) de création de produit trouvé(s)" -ForegroundColor Green
    Write-Host ""
    
    # Grouper par timestamp et afficher les plus récents
    $productCreationLogs | Sort-Object -Property timestamp -Descending | Select-Object -First 20 | ForEach-Object {
        $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
        $severity = if ($_.severity) { $_.severity } else { "INFO" }
        $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
        $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Compress) } else { "" }
        $message = if ($textPayload) { $textPayload } else { $jsonPayload }
        
        $color = switch ($severity) {
            "ERROR" { "Red" }
            "WARNING" { "Yellow" }
            default { "White" }
        }
        
        Write-Host "   [$timestamp] $severity" -ForegroundColor $color -NoNewline
        Write-Host " : $($message.Substring(0, [Math]::Min(300, $message.Length)))" -ForegroundColor Gray
        if ($message.Length -gt 300) {
            Write-Host "      ..." -ForegroundColor Gray
        }
        Write-Host ""
    }
} else {
    Write-Host "   ⚠️  Aucun log de création de produit trouvé" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# FILTRES POUR ERREURS OPENAI
# ============================================================================
Write-Host "2️⃣  ERREURS OPENAI" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

$openaiErrorLogs = $allLogs | Where-Object {
    $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
    $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Depth 10) } else { "" }
    $combined = "$textPayload $jsonPayload".ToLower()
    
    $combined -like '*openai*' -or
    $combined -like '*OPENAI*' -or
    $combined -like '*api*key*' -or
    $combined -like '*401*' -or
    $combined -like '*403*' -or
    $combined -like '*unauthorized*' -or
    $combined -like '*forbidden*' -or
    $combined -like '*OPENAI_API_KEY*' -or
    $combined -like '*non trouvée*' -or
    $combined -like '*non configurée*' -or
    $combined -like '*not found*' -or
    $combined -like '*missing*' -or
    $combined -like '*app_ia*' -or
    $combined -like '*predict*' -or
    $combined -like '*gpt*' -or
    $combined -like '*model*error*'
}

if ($openaiErrorLogs) {
    Write-Host "   ⚠️  $($openaiErrorLogs.Count) log(s) d'erreur OpenAI trouvé(s)" -ForegroundColor Yellow
    Write-Host ""
    
    $openaiErrorLogs | Sort-Object -Property timestamp -Descending | Select-Object -First 30 | ForEach-Object {
        $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
        $severity = if ($_.severity) { $_.severity } else { "INFO" }
        $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
        $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Compress) } else { "" }
        $message = if ($textPayload) { $textPayload } else { $jsonPayload }
        
        Write-Host "   [$timestamp] $severity" -ForegroundColor Red -NoNewline
        Write-Host " : $($message.Substring(0, [Math]::Min(400, $message.Length)))" -ForegroundColor Gray
        if ($message.Length -gt 400) {
            Write-Host "      ..." -ForegroundColor Gray
        }
        Write-Host ""
    }
} else {
    Write-Host "   ✅ Aucune erreur OpenAI trouvée dans les logs" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# FILTRES POUR ERREURS GÉNÉRALES
# ============================================================================
Write-Host "3️⃣  ERREURS GÉNÉRALES (ERROR/WARNING)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

$errorLogs = $allLogs | Where-Object {
    $severity = if ($_.severity) { $_.severity } else { "INFO" }
    ($severity -eq "ERROR" -or $severity -eq "WARNING") -and
    ($_.textPayload -or $_.jsonPayload)
}

if ($errorLogs) {
    Write-Host "   ⚠️  $($errorLogs.Count) log(s) d'erreur/avertissement trouvé(s)" -ForegroundColor Yellow
    Write-Host ""
    
    # Filtrer pour ne garder que ceux liés à la création de produit ou IA
    $relevantErrors = $errorLogs | Where-Object {
        $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
        $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Depth 10) } else { "" }
        $combined = "$textPayload $jsonPayload".ToLower()
        
        $combined -like '*creer_service*' -or
        $combined -like '*product*' -or
        $combined -like '*openai*' -or
        $combined -like '*ia*' -or
        $combined -like '*api*'
    }
    
    if ($relevantErrors) {
        $relevantErrors | Sort-Object -Property timestamp -Descending | Select-Object -First 20 | ForEach-Object {
            $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
            $severity = if ($_.severity) { $_.severity } else { "INFO" }
            $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
            $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Compress) } else { "" }
            $message = if ($textPayload) { $textPayload } else { $jsonPayload }
            
            $color = if ($severity -eq "ERROR") { "Red" } else { "Yellow" }
            
            Write-Host "   [$timestamp] $severity" -ForegroundColor $color -NoNewline
            Write-Host " : $($message.Substring(0, [Math]::Min(300, $message.Length)))" -ForegroundColor Gray
            if ($message.Length -gt 300) {
                Write-Host "      ..." -ForegroundColor Gray
            }
            Write-Host ""
        }
    } else {
        Write-Host "   ✅ Aucune erreur pertinente trouvée" -ForegroundColor Green
    }
} else {
    Write-Host "   ✅ Aucune erreur trouvée" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# ANALYSE SPÉCIFIQUE : INITIALISATION OPENAI
# ============================================================================
Write-Host "4️⃣  INITIALISATION OPENAI_API_KEY" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

$initLogs = $allLogs | Where-Object {
    $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
    $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Depth 10) } else { "" }
    $combined = "$textPayload $jsonPayload"
    
    $combined -like '*OPENAI_API_KEY*' -or
    $combined -like '*initialize_models*' -or
    $combined -like '*AppIA*' -or
    $combined -like '*modèles IA*'
}

if ($initLogs) {
    Write-Host "   ✅ $($initLogs.Count) log(s) d'initialisation trouvé(s)" -ForegroundColor Green
    Write-Host ""
    
    $initLogs | Sort-Object -Property timestamp -Descending | Select-Object -First 10 | ForEach-Object {
        $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
        $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
        $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Compress) } else { "" }
        $message = if ($textPayload) { $textPayload } else { $jsonPayload }
        
        Write-Host "   [$timestamp]" -ForegroundColor Cyan -NoNewline
        Write-Host " : $($message.Substring(0, [Math]::Min(400, $message.Length)))" -ForegroundColor White
        if ($message.Length -gt 400) {
            Write-Host "      ..." -ForegroundColor Gray
        }
        Write-Host ""
    }
} else {
    Write-Host "   ⚠️  Aucun log d'initialisation trouvé" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# RÉSUMÉ ET RECOMMANDATIONS
# ============================================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "RESUME DE L ANALYSE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logs analysés: $($allLogs.Count)" -ForegroundColor White
Write-Host "Création produit: $($productCreationLogs.Count)" -ForegroundColor $(if ($productCreationLogs) { "Yellow" } else { "Green" })
Write-Host "Erreurs OpenAI: $($openaiErrorLogs.Count)" -ForegroundColor $(if ($openaiErrorLogs) { "Red" } else { "Green" })
Write-Host "Erreurs générales: $($errorLogs.Count)" -ForegroundColor $(if ($errorLogs) { "Yellow" } else { "Green" })
Write-Host ""

if ($openaiErrorLogs -or ($productCreationLogs | Where-Object { $_.severity -eq "ERROR" })) {
    $msg = "RECOMMANDATIONS: Verifier secret openai-api-key, Cloud Run, IAM"
    Write-Host $msg -ForegroundColor Yellow
}

# Commande pour logs en temps reel: gcloud logging tail "<filter>" --project=$GcpProjectId

