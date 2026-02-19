# Script PowerShell pour vérifier les secrets dans GCP Secret Manager

$PROJECT_ID = "yukpo-project"
$SERVICE_ACCOUNT = "yukpo-backend@yukpo-project.iam.gserviceaccount.com"

Write-Host "🔍 VÉRIFICATION DES SECRETS - Secret Manager" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$secrets = @("database-url", "jwt-secret", "redis-url", "mongodb-url")

foreach ($secret in $secrets) {
    Write-Host "Vérification du secret: $secret" -ForegroundColor Yellow
    Write-Host "--------------------------------" -ForegroundColor Yellow
    
    # Vérifier si le secret existe
    $exists = gcloud secrets describe $secret --project $PROJECT_ID 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret '$secret' existe" -ForegroundColor Green
        
        # Vérifier les versions
        Write-Host "   Versions disponibles:" -ForegroundColor Gray
        gcloud secrets versions list $secret --project $PROJECT_ID --format='table(name,state,createTime)' 2>&1 | Out-String
        
        # Vérifier les permissions IAM
        Write-Host "   Permissions IAM:" -ForegroundColor Gray
        $iam = gcloud secrets get-iam-policy $secret --project $PROJECT_ID 2>&1
        if ($iam -match $SERVICE_ACCOUNT) {
            Write-Host "   ✅ Service account a accès" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Service account n'a peut-être pas accès" -ForegroundColor Yellow
            Write-Host "   Permissions actuelles:" -ForegroundColor Gray
            $iam | Select-String -Pattern "members:|role:" | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
        }
    } else {
        Write-Host "❌ Secret '$secret' N'EXISTE PAS !" -ForegroundColor Red
        Write-Host "   Il faut le créer dans Secret Manager" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "📋 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "=========" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si un secret n'existe pas, créez-le avec :" -ForegroundColor Yellow
Write-Host ""
Write-Host "# Exemple pour database-url" -ForegroundColor Gray
Write-Host "echo -n 'votre-valeur' | gcloud secrets create database-url --data-file=- --project $PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "# Donner accès au service account" -ForegroundColor Gray
Write-Host "gcloud secrets add-iam-policy-binding database-url --member='serviceAccount:$SERVICE_ACCOUNT' --role='roles/secretmanager.secretAccessor' --project $PROJECT_ID" -ForegroundColor White

