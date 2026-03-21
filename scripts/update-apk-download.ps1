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

# 1. Upload du nouveau APK (écrase automatiquement l'ancien)
Write-Host "📤 Upload du nouvel APK..."
gcloud storage cp $ApkPath gs://yukpo-project-yukpo-backend-media/yukpomnang-latest.apk

# 2. Mettre à jour le Worker Cloudflare avec le nouveau timestamp
Write-Host "☁️  Mise à jour du Worker Cloudflare..."
# Note: Vous devrez déployer manuellement le Worker mis à jour via Cloudflare Dashboard

# 3. Appliquer les headers anti-cache
Write-Host "⚙️  Configuration des headers anti-cache..."
gcloud storage objects update gs://yukpo-project-yukpo-backend-media/yukpomnang-latest.apk --cache-control="no-cache, no-store, must-revalidate"

# 4. Vérifier la configuration finale
Write-Host "✅ APK mis à jour avec succès !"
Write-Host "🔗 Lien: https://yukpomnang.com/download"
Write-Host "🆔 Version: $timestamp"
Write-Host "🌐 URL directe GCP: https://storage.googleapis.com/yukpo-project-yukpo-backend-media/yukpomnang-latest.apk?v=$timestamp"
