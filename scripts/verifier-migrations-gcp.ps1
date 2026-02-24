# Appelle GET /health/migrations-check sur le backend GCP pour vérifier les colonnes users (partner_status, partner_type, free_product_created).
# Usage: .\scripts\verifier-migrations-gcp.ps1 [-BackendUrl "https://..."]
# Après déploiement du backend avec l'endpoint /health/migrations-check.

param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app"
)

$uri = "$BackendUrl/health/migrations-check"
Write-Host "Verification des migrations (colonnes users) sur: $uri" -ForegroundColor Cyan
try {
    $r = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 30
    Write-Host "table_users_exists: $($r.table_users_exists)"
    Write-Host "partner_status:     $($r.partner_status)"
    Write-Host "partner_type:       $($r.partner_type)"
    Write-Host "free_product_created: $($r.free_product_created)"
    Write-Host "login_ready:        $($r.login_ready)"
    Write-Host "message:            $($r.message)"
    if ($r.login_ready) {
        Write-Host "OK - Colonnes requises pour le login presentes." -ForegroundColor Green
    } else {
        Write-Host "ATTENTION - Appliquer les migrations (voir VERIFICATION_MIGRATIONS_GCP.md)." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "L'endpoint /health/migrations-check n'existe pas: redéployer le backend puis relancer ce script." -ForegroundColor Yellow
    }
    exit 1
}
