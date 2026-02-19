# Script pour créer la table delivery_proximity_suggestions sur GCP Cloud SQL
param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceId = "yukpo-postgres",
    [string]$Database = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "`n🔧 CRÉATION DE LA TABLE delivery_proximity_suggestions`n" -ForegroundColor Cyan

Write-Host "Options:" -ForegroundColor Yellow
Write-Host "1. Exécuter via gcloud sql connect (interactif)" -ForegroundColor White
Write-Host "2. Exécuter via Cloud SQL Proxy" -ForegroundColor White
Write-Host "3. Afficher le script SQL à exécuter manuellement" -ForegroundColor White

$choice = Read-Host "`nChoisissez une option (1-3)"

if ($choice -eq "1") {
    Write-Host "`nExécution via gcloud sql connect..." -ForegroundColor Yellow
    Write-Host "Commande à exécuter:" -ForegroundColor Cyan
    Write-Host "gcloud sql connect $InstanceId --user=$User --database=$Database --project=$ProjectId" -ForegroundColor White
    Write-Host "`nPuis copiez-collez le contenu de scripts/fix-delivery-proximity-table.sql" -ForegroundColor Yellow
} elseif ($choice -eq "2") {
    Write-Host "`nExécution via Cloud SQL Proxy..." -ForegroundColor Yellow
    Write-Host "1. Démarrer Cloud SQL Proxy:" -ForegroundColor Cyan
    Write-Host "   cloud_sql_proxy -instances=$ProjectId`:europe-west1:$InstanceId=tcp:5432" -ForegroundColor White
    Write-Host "`n2. Dans un autre terminal, exécutez:" -ForegroundColor Cyan
    Write-Host "   psql -h localhost -U $User -d $Database -f scripts/fix-delivery-proximity-table.sql" -ForegroundColor White
} else {
    Write-Host "`n📋 Script SQL à exécuter:" -ForegroundColor Cyan
    Write-Host "==========================================`n" -ForegroundColor Cyan
    Get-Content "scripts/fix-delivery-proximity-table.sql" | Write-Host
    Write-Host "`n==========================================" -ForegroundColor Cyan
    Write-Host "`nExécutez ce script sur votre base de données GCP Cloud SQL" -ForegroundColor Yellow
}

Write-Host "`n✅ Après exécution, les erreurs 'relation does not exist' devraient disparaître" -ForegroundColor Green


