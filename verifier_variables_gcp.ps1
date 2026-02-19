# Script PowerShell pour vérifier les variables d'environnement dans GCP Cloud Run

$PROJECT_ID = "yukpo-project"
$SERVICE_NAME = "yukpo-backend"
$REGION = "europe-west1"

Write-Host "🔍 VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT - Cloud Run" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Variables d'environnement définies :" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
gcloud run services describe $SERVICE_NAME `
  --region $REGION `
  --format="table(spec.template.spec.containers[0].env[].name,spec.template.spec.containers[0].env[].value)" `
  --project $PROJECT_ID

Write-Host ""
Write-Host "2. Secrets référencés :" -ForegroundColor Yellow
Write-Host "----------------------" -ForegroundColor Yellow
gcloud run services describe $SERVICE_NAME `
  --region $REGION `
  --format="yaml(spec.template.spec.containers[0].envFrom)" `
  --project $PROJECT_ID

Write-Host ""
Write-Host "3. Vérification CLOUD_RUN :" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow
$CLOUD_RUN = gcloud run services describe $SERVICE_NAME `
  --region $REGION `
  --format="value(spec.template.spec.containers[0].env)" `
  --project $PROJECT_ID | Select-String "CLOUD_RUN"

if ($CLOUD_RUN) {
    Write-Host "✅ CLOUD_RUN trouvé : $CLOUD_RUN" -ForegroundColor Green
} else {
    Write-Host "❌ CLOUD_RUN NON TROUVÉ !" -ForegroundColor Red
    Write-Host "   Il faut définir CLOUD_RUN=true dans Cloud Run" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Secrets dans Secret Manager :" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow
gcloud secrets list --project $PROJECT_ID --filter="name:database-url OR name:jwt-secret OR name:redis-url OR name:mongodb-url"

Write-Host ""
Write-Host "5. Derniers logs (10 dernières lignes) :" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" `
  --limit 10 `
  --format="table(timestamp,severity,textPayload)" `
  --project $PROJECT_ID

Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Green


