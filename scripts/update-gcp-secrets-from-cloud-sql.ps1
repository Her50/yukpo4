# Script pour mettre à jour les secrets GCP avec les vraies valeurs depuis Cloud SQL
param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$DbInstance = "yukpo-postgres",
    [string]$DbUser = "yukpo_user",
    [string]$DbName = "yukpo_postgres",  # Base principale selon CLARIFICATION_BASES_DONNEES_GCP.md
    [string]$Region = "europe-west1"
)

Write-Host "Mise a jour des secrets GCP depuis Cloud SQL..." -ForegroundColor Yellow
Write-Host ""

# Récupérer les informations Cloud SQL
Write-Host "Recuperation des informations Cloud SQL..." -ForegroundColor Cyan
$dbInfo = gcloud sql instances describe $DbInstance --project=$GcpProjectId --format="json" 2>&1 | ConvertFrom-Json
$connectionName = $dbInfo.connectionName
$ipAddress = ($dbInfo.ipAddresses | Where-Object { $_.type -eq "PRIMARY" } | Select-Object -First 1).ipAddress

Write-Host "Instance: $DbInstance" -ForegroundColor Green
Write-Host "Connection Name: $connectionName" -ForegroundColor Green
Write-Host "IP: $ipAddress" -ForegroundColor Green
Write-Host ""

# Demander le mot de passe
Write-Host "IMPORTANT: Vous devez connaitre le mot de passe de l'utilisateur $DbUser" -ForegroundColor Yellow
$password = Read-Host "Entrez le mot de passe pour $DbUser (ou appuyez sur Entree pour utiliser format sans mot de passe)" -AsSecureString

if ($password.Length -eq 0) {
    Write-Host "⚠️  Mot de passe non fourni. Utilisation du format Unix socket sans mot de passe dans l'URL." -ForegroundColor Yellow
    Write-Host "   Vous devrez mettre a jour manuellement avec le vrai mot de passe." -ForegroundColor Yellow
    $passwordPlain = ""
} else {
    $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    )
}

# Créer DATABASE_URL au format Unix socket (recommandé pour Cloud Run)
if ([string]::IsNullOrEmpty($passwordPlain)) {
    $databaseUrl = "postgresql://${DbUser}@/${DbName}?host=/cloudsql/${connectionName}"
    Write-Host "⚠️  DATABASE_URL creee SANS mot de passe - A METTRE A JOUR MANUELLEMENT" -ForegroundColor Yellow
} else {
    # Échapper les caractères spéciaux dans le mot de passe pour l'URL
    $passwordEscaped = [System.Web.HttpUtility]::UrlEncode($passwordPlain)
    $databaseUrl = "postgresql://${DbUser}:${passwordEscaped}@/${DbName}?host=/cloudsql/${connectionName}"
}

Write-Host ""
Write-Host "DATABASE_URL genere:" -ForegroundColor Cyan
Write-Host $databaseUrl -ForegroundColor Gray
Write-Host ""

# Mettre à jour le secret
Write-Host "Mise a jour du secret database-url..." -ForegroundColor Cyan
echo -n $databaseUrl | gcloud secrets versions add database-url --data-file=- --project=$GcpProjectId 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secret database-url mis a jour" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la mise a jour" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pour les autres secrets (REDIS_URL, MONGODB_URL, JWT_SECRET):" -ForegroundColor Yellow
Write-Host "  - REDIS_URL: Doit pointer vers Cloud Memorystore Redis" -ForegroundColor Yellow
Write-Host "  - MONGODB_URL: Doit pointer vers votre instance MongoDB" -ForegroundColor Yellow
Write-Host "  - JWT_SECRET: Doit etre une cle secrete aleatoire (generer avec: openssl rand -hex 32)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Commandes pour mettre a jour:" -ForegroundColor Cyan
Write-Host "echo -n 'VOTRE_REDIS_URL' | gcloud secrets versions add redis-url --data-file=- --project=$GcpProjectId"
Write-Host "echo -n 'VOTRE_MONGODB_URL' | gcloud secrets versions add mongodb-url --data-file=- --project=$GcpProjectId"
Write-Host "echo -n 'VOTRE_JWT_SECRET' | gcloud secrets versions add jwt-secret --data-file=- --project=$GcpProjectId"

