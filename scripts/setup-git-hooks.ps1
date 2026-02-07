# Script PowerShell pour configurer les hooks Git
# À exécuter une seule fois après le clonage du dépôt

Write-Host "🔧 Configuration des hooks Git..." -ForegroundColor Cyan

$hooksDir = ".git\hooks"
$preCommitHook = "$hooksDir\pre-commit"

# Créer le hook pre-commit
$hookContent = @"
#!/bin/bash
# Pre-commit hook pour formater automatiquement le code Rust

# Aller dans le répertoire backend
cd backend 2>/dev/null || exit 0

# Vérifier si cargo est disponible
if ! command -v cargo &> /dev/null; then
    echo "⚠️  cargo non trouvé, formatage ignoré"
    exit 0
fi

# Formater le code Rust
echo "🔧 Formatage du code Rust..."
cargo fmt

# Ajouter les fichiers formatés au staging
git add -u

echo "✅ Code Rust formaté automatiquement"
"@

# Écrire le hook
[System.IO.File]::WriteAllText($preCommitHook, $hookContent)

Write-Host "✅ Hook pre-commit créé: $preCommitHook" -ForegroundColor Green
Write-Host ""
Write-Host "📌 Note: Sur Windows, Git utilise Git Bash pour exécuter les hooks." -ForegroundColor Yellow
Write-Host "   Le hook devrait fonctionner automatiquement lors des commits." -ForegroundColor Yellow
Write-Host ""
Write-Host "🧪 Pour tester le hook:" -ForegroundColor Cyan
Write-Host "   1. Modifier un fichier Rust dans backend/src/" -ForegroundColor White
Write-Host "   2. git add ." -ForegroundColor White
Write-Host "   3. git commit -m 'test'" -ForegroundColor White
Write-Host "   4. Le hook devrait formater automatiquement" -ForegroundColor White

