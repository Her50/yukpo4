# Script pour nettoyer l'historique Git et supprimer les URLs Render
# ATTENTION: Cette opération réécrit l'historique Git

Write-Host "⚠️  ATTENTION: Cette opération va réécrire l'historique Git" -ForegroundColor Yellow
Write-Host "⚠️  Tous les commits seront modifiés" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Voulez-vous continuer? (oui/non)"

if ($confirm -ne "oui") {
    Write-Host "❌ Opération annulée" -ForegroundColor Red
    exit 1
}

Write-Host "🧹 Nettoyage de l'historique Git..." -ForegroundColor Green

# Utiliser git filter-branch pour remplacer toutes les occurrences dans l'historique
# Variables de remplacement (les valeurs réelles ont été supprimées pour sécurité)
$renderUrl = "postgresql://yukpo_db_user:YOUR_PASSWORD@your-render-db-host.render.com/yukpo_db"
$renderHost = "your-render-db-host.render.com"
$password = "YOUR_PASSWORD"

$placeholderUrl = "postgresql://user:password@host:port/database"
$placeholderHost = "your-render-db-host.render.com"
$placeholderPassword = "YOUR_PASSWORD"

# Créer un script de remplacement temporaire
$replaceScript = @"
#!/bin/sh
git ls-files | while read file; do
    if [ -f "$file" ]; then
        sed -i 's|$renderUrl|$placeholderUrl|g' "$file"
        sed -i 's|$renderHost|$placeholderHost|g' "$file"
        sed -i 's|$password|$placeholderPassword|g' "$file"
    fi
done
"@

# Pour Windows, utiliser PowerShell avec git filter-branch
Write-Host "📝 Création du script de remplacement..." -ForegroundColor Cyan

# Utiliser git filter-repo si disponible, sinon git filter-branch
$hasFilterRepo = git filter-repo --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Utilisation de git filter-repo..." -ForegroundColor Green
    # git filter-repo est plus moderne et plus rapide
    git filter-repo --replace-text <(echo "$password==>$placeholderPassword")
} else {
    Write-Host "⚠️  git filter-repo non disponible, utilisation de git filter-branch..." -ForegroundColor Yellow
    Write-Host "⚠️  Cette opération peut prendre du temps..." -ForegroundColor Yellow
    
    # Utiliser git filter-branch avec --tree-filter
    git filter-branch --force --index-filter @"
git ls-files | while read file; do
    if [ -f "$file" ]; then
        sed -i 's|$renderUrl|$placeholderUrl|g' "$file"
        sed -i 's|$renderHost|$placeholderHost|g' "$file"
        sed -i 's|$password|$placeholderPassword|g' "$file"
    fi
done
git add -A
"@ --prune-empty --tag-name-filter cat -- --all
}

Write-Host "✅ Historique Git nettoyé" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Vous devez maintenant forcer le push avec:" -ForegroundColor Yellow
Write-Host "   git push --force --all" -ForegroundColor Cyan
Write-Host "   git push --force --tags" -ForegroundColor Cyan

