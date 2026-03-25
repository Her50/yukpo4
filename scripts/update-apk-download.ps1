#!/usr/bin/env pwsh

# Script de mise à jour automatique de l'APK avec anti-cache
# Usage: .\update-apk-download.ps1 "C:\Users\23767\Downloads\application-xxx.apk"

param(
    [Parameter(Mandatory = $true)]
    [string]$ApkPath
)

# Vérifier que le fichier existe
if (-not (Test-Path $ApkPath)) {
    Write-Error "Fichier APK non trouvé: $ApkPath"
    exit 1
}

# Générer un timestamp unique
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
Write-Host "📅 Timestamp: $timestamp"

# 1. Upload du nouveau APK (chemin unique utilise par /download)
Write-Host "📤 Upload du nouvel APK..."
gcloud storage cp $ApkPath gs://yukpo-project-yukpo-backend-media/app/yukpo.apk

# 2. Mettre à jour le Worker Cloudflare avec le nouveau timestamp
Write-Host "☁️  Mise à jour du Worker Cloudflare..."
# Note: Vous devrez déployer manuellement le Worker mis à jour via Cloudflare Dashboard

# 3. Appliquer les headers anti-cache
Write-Host "⚙️  Configuration des headers anti-cache..."
gcloud storage objects update gs://yukpo-project-yukpo-backend-media/app/yukpo.apk --cache-control="no-cache, no-store, must-revalidate"

# 4. Vérifier la configuration finale
Write-Host "✅ APK mis à jour avec succès !"
Write-Host "🔗 Lien: https://yukpomnang.com/download"
Write-Host "🆔 Version: $timestamp"
Write-Host "🌐 URL directe GCP: https://storage.googleapis.com/yukpo-project-yukpo-backend-media/app/yukpo.apk?v=$timestamp"
Write-Host ""
Write-Host "⚠️  MISES A JOUR IN-APP (/app/update/check) :" -ForegroundColor Yellow
Write-Host "   Sur Cloud Run, definissez ANDROID_LATEST_VERSION_CODE au versionCode Android"
Write-Host "   de CET APK (Gradle / EAS). Sinon les telephones avec un versionCode deja >= 3"
Write-Host "   ne verront jamais de mise a jour (comparaison serveur obsolete)."
Write-Host "   Optionnel: ANDROID_LATEST_VERSION_NAME, ANDROID_APK_SIZE_BYTES (octets)."
Write-Host ""
Write-Host "   Exemple gcloud (adapter service et projet):"
Write-Host "   gcloud run services update VOTRE_SERVICE --set-env-vars ANDROID_LATEST_VERSION_CODE=123"
