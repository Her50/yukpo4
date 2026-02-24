# Diagnostic GCP - Création produit (bouton tourne à l'infini)
# Récupère les logs backend et cherche : POST/GET products, queue, worker ProductCreationQueue
# Usage : .\scripts\diagnostic-creation-produit-gcp.ps1 [-Project "yukpo-project"] [-Service "yukpo-backend"] [-Minutes 30]

param(
    [string]$Project = "yukpo-project",
    [string]$Service = "yukpo-backend",
    [int]$Minutes = 30
)

$ErrorActionPreference = "Stop"
$outDir = Join-Path $PSScriptRoot ".."
$outFile = Join-Path $outDir "logs-backend-creation-$($Minutes)m.json"

Write-Host "Récupération des logs GCP ($Minutes min) pour le service $Service (projet $Project)..." -ForegroundColor Cyan
try {
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$Service" `
        --limit=800 --project=$Project --format=json --freshness="${Minutes}m" 2>&1 | Set-Content -Path $outFile -Encoding utf8
} catch {
    Write-Host "Erreur gcloud: $_" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
    Write-Host "Aucun log récupéré. Vérifier projet/service et gcloud auth." -ForegroundColor Yellow
    exit 1
}

Write-Host "Logs sauvegardés : $outFile" -ForegroundColor Green
Write-Host ""
Write-Host "Recherche des entrées liées à la création produit..." -ForegroundColor Cyan

$patterns = @(
    "add_product_to_service",
    "ProductCreationQueue",
    "process_product_creation",
    "products/queue",
    "job_id",
    "get_product_creation_status"
)
$content = Get-Content -Path $outFile -Raw -Encoding utf8
$found = @()
foreach ($p in $patterns) {
    if ($content.IndexOf($p, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        $found += $p
    }
}
if ($found.Count -eq 0) {
    Write-Host "Aucune occurrence des mots-clés (add_product_to_service, ProductCreationQueue, process_product_creation, products/queue, job_id) dans les logs." -ForegroundColor Yellow
    Write-Host "Soit aucune création produit récente, soit les logs sont structurés différemment." -ForegroundColor Gray
} else {
    Write-Host "Mots-clés trouvés : $($found -join ', ')" -ForegroundColor Green
}

# Compter les lignes contenant des URLs products
$lines = Get-Content -Path $outFile -Encoding utf8
$postProducts = ($lines | Select-String -Pattern "products" | Select-String -Pattern "POST|post" -SimpleMatch).Count
$getQueue = ($lines | Select-String -Pattern "products/queue|queue/").Count
$worker = ($lines | Select-String -Pattern "ProductCreationQueue|Worker démarré|job\(s\) en attente").Count
$errors = ($lines | Select-String -Pattern '"severity":"ERROR"|"severity": "ERROR"').Count

Write-Host ""
Write-Host "--- Résumé ---" -ForegroundColor Cyan
Write-Host "  Lignes évoquant POST/products : ~$postProducts"
Write-Host "  Lignes évoquant products/queue : ~$getQueue"
Write-Host "  Lignes Worker/ProductCreationQueue : ~$worker"
Write-Host "  Entrées ERROR : $errors"
Write-Host ""
Write-Host "Pour une analyse détaillée, ouvrir : ANALYSE_CREATION_PRODUIT_BOUTON_INFINI.md" -ForegroundColor Gray
