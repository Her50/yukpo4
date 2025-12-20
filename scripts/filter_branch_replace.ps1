# Script pour nettoyer l'historique Git avec git filter-branch
# Remplace toutes les occurrences du mot de passe Render dans l'historique

# Variables de remplacement (les valeurs réelles ont été supprimées pour sécurité)
$password = "YOUR_PASSWORD"
$renderUrl = "postgresql://yukpo_db_user:YOUR_PASSWORD@your-render-db-host.render.com/yukpo_db"
$renderHost = "your-render-db-host.render.com"

Write-Host "🧹 Nettoyage de l'historique Git..." -ForegroundColor Green
Write-Host "⚠️  Cette opération peut prendre du temps..." -ForegroundColor Yellow

# Créer un fichier de remplacement pour git filter-branch
$replaceFile = "scripts/git-filter-replace.txt"
@"
$password==>YOUR_PASSWORD
$renderUrl==>postgresql://user:password@host:port/database
$renderHost==>your-render-db-host.render.com
yukpo_db_user:YOUR_PASSWORD==>user:password
"@ | Out-File -FilePath $replaceFile -Encoding utf8

Write-Host "📝 Fichier de remplacement créé: $replaceFile" -ForegroundColor Cyan

# Utiliser git filter-branch avec --tree-filter
# Note: Sur Windows, on utilise PowerShell pour le remplacement
Write-Host "🔄 Application du filtre sur l'historique..." -ForegroundColor Cyan

git filter-branch --force --tree-filter @"
powershell -Command `"
`$files = Get-ChildItem -Recurse -File | Where-Object { `$_.FullName -notmatch '\.git' }
foreach (`$file in `$files) {
    if (Test-Path `$file.FullName) {
        `$content = Get-Content `$file.FullName -Raw -ErrorAction SilentlyContinue
        if (`$content) {
            `$content = `$content -replace [regex]::Escape('$password'), 'YOUR_PASSWORD'
            `$content = `$content -replace [regex]::Escape('$renderUrl'), 'postgresql://user:password@host:port/database'
            `$content = `$content -replace [regex]::Escape('$renderHost'), 'your-render-db-host.render.com'
            Set-Content -Path `$file.FullName -Value `$content -NoNewline
        }
    }
}
`"
"@ --prune-empty --tag-name-filter cat -- --all

Write-Host "✅ Historique Git nettoyé" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Vous devez maintenant forcer le push avec:" -ForegroundColor Yellow
Write-Host "   git push --force --all" -ForegroundColor Cyan
Write-Host "   git push --force --tags" -ForegroundColor Cyan

