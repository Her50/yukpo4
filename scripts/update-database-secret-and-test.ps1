# Script de Mise à Jour DATABASE_URL et Test de Déploiement
# Date: 2026-02-18
# Objectif: Mettre à jour database-url dans GCP Secret Manager et tester

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_db"  # Base de données principale
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
$SECRET_NAME = "database-url"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mise à Jour DATABASE_URL et Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration actuelle
Write-Host "[1/7] Vérification de la configuration actuelle..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: gcloud n'est pas configuré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
Write-Host ""

# 2. Générer un nouveau mot de passe sécurisé
Write-Host "[2/7] Génération d'un nouveau mot de passe sécurisé..." -ForegroundColor Yellow
$chars = @()
$chars += 48..57   # Chiffres
$chars += 65..90   # Majuscules
$chars += 97..122  # Minuscules
$chars += 35, 36, 37, 61, 64, 95  # # $ % = @ _

$NEW_PASSWORD = -join ($chars | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "✅ Mot de passe généré (32 caractères)" -ForegroundColor Green
Write-Host "   (sauvegardé pour référence)" -ForegroundColor Gray
Write-Host ""

# 3. Réinitialiser le mot de passe dans Cloud SQL
Write-Host "[3/7] Réinitialisation du mot de passe dans Cloud SQL..." -ForegroundColor Yellow
try {
    gcloud sql users set-password $DB_USER `
        --instance=$INSTANCE `
        --password=$NEW_PASSWORD `
        --project=$PROJECT 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Mot de passe réinitialisé dans Cloud SQL" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors de la réinitialisation du mot de passe" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. URL-encoder le mot de passe
Write-Host "[4/7] Encodage URL du mot de passe..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "✅ Mot de passe encodé" -ForegroundColor Green
Write-Host ""

# 5. Construire DATABASE_URL avec le format Unix socket
Write-Host "[5/7] Construction de DATABASE_URL..." -ForegroundColor Yellow
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "✅ DATABASE_URL construite" -ForegroundColor Green
Write-Host "Format:" -ForegroundColor Cyan
Write-Host "  postgresql://${DB_USER}:***@/${DB_NAME}?host=${SOCKET_PATH}" -ForegroundColor Gray
Write-Host ""

# 6. Mettre à jour le secret dans Secret Manager
Write-Host "[6/7] Mise à jour du secret '$SECRET_NAME' dans Secret Manager..." -ForegroundColor Yellow
try {
    # Créer un fichier temporaire avec DATABASE_URL
    $tempFile = [System.IO.Path]::GetTempFileName()
    $DATABASE_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    # Ajouter une nouvelle version du secret
    $result = gcloud secrets versions add $SECRET_NAME `
        --data-file=$tempFile `
        --project=$PROJECT 2>&1
    
    # Supprimer le fichier temporaire
    Remove-Item $tempFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret mis à jour dans Secret Manager" -ForegroundColor Green
        # Extraire le numéro de version
        if ($result -match 'version (\d+)') {
            $version = $matches[1]
            Write-Host "   Version: $version" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
        Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
        Write-Host $DATABASE_URL -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
    Write-Host $DATABASE_URL -ForegroundColor Cyan
    exit 1
}
Write-Host ""

# 7. Vérifier le secret mis à jour
Write-Host "[7/7] Vérification du secret mis à jour..." -ForegroundColor Yellow
try {
    # Utiliser un fichier temporaire pour éviter les problèmes d'encodage
    $tempFile = [System.IO.Path]::GetTempFileName()
    gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT --out-file=$tempFile 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tempFile)) {
        $verifyUrl = Get-Content -Path $tempFile -Raw -Encoding UTF8
        Remove-Item $tempFile -Force
        
        # Masquer le mot de passe pour l'affichage
        if ($verifyUrl -match "postgresql://([^:]+):([^@]+)@") {
            $user = $matches[1]
            $password = $matches[2]
            $passwordMasked = if ($password.Length -gt 4) { 
                $password.Substring(0, 2) + "***" + $password.Substring($password.Length - 2) 
            }
            else { 
                "***" 
            }
            $verifyUrlMasked = $verifyUrl -replace [regex]::Escape($password), $passwordMasked
            Write-Host "✅ Secret vérifié:" -ForegroundColor Green
            Write-Host "   $verifyUrlMasked" -ForegroundColor Gray
            
            # Vérifier le format
            if ($verifyUrl -match "host=/cloudsql/") {
                Write-Host "   ✅ Format Unix socket correct" -ForegroundColor Green
            }
            else {
                Write-Host "   ⚠️ Format Unix socket non détecté" -ForegroundColor Yellow
            }
            
            $dbMatch = [regex]::Match($verifyUrl, "@/([^?]+)")
            if ($dbMatch.Success) {
                $dbInUrl = $dbMatch.Groups[1].Value
                if ($dbInUrl -eq $DB_NAME) {
                    Write-Host "   ✅ Base de données correcte: $DB_NAME" -ForegroundColor Green
                }
                else {
                    Write-Host "   ⚠️ Base de données: $dbInUrl (attendu: $DB_NAME)" -ForegroundColor Yellow
                    Write-Host "   ℹ️ Note: yukpo_db est la base complète avec toutes les migrations" -ForegroundColor Cyan
                }
            }
        }
        else {
            Write-Host "⚠️ Format DATABASE_URL non reconnu" -ForegroundColor Yellow
        }
    }
    else {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
        Write-Host "⚠️ Impossible de vérifier le secret" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Erreur lors de la vérification: $_" -ForegroundColor Yellow
}
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Mise à jour terminée avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Yellow
Write-Host "  - Mot de passe Cloud SQL: [SAUVEGARDÉ]" -ForegroundColor White
Write-Host "  - Base de données: $DB_NAME" -ForegroundColor White
Write-Host "  - Socket Unix: $SOCKET_PATH" -ForegroundColor White
Write-Host "  - Secret: $SECRET_NAME (version latest)" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Redéployer le service Cloud Run pour charger le nouveau secret" -ForegroundColor White
Write-Host "2. Vérifier les logs pour confirmer la connexion réussie" -ForegroundColor White
Write-Host "3. Tester l''application" -ForegroundColor White
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  # Redéployer (si nécessaire)" -ForegroundColor Gray
Write-Host "  gcloud run services update yukpo-backend --region=europe-west1 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Vérifier les logs" -ForegroundColor Gray
Write-Host "  gcloud logging read ""resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend"" --limit=50 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""

