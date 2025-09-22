# cursor-optimization.ps1
# Optimisation Cursor pour le développement Yukpomnang

Write-Host "🔧 Optimisation Cursor pour Yukpomnang" -ForegroundColor Green

# 1. Créer un workspace Cursor optimisé
Write-Host "`n📁 Configuration du workspace Cursor..." -ForegroundColor Yellow

# Créer le fichier .vscode/settings.json optimisé
$vscodeSettings = @{
    "rust-analyzer.checkOnSave" = $true
    "rust-analyzer.cargo.features" = "all"
    "typescript.preferences.importModuleSpecifier" = "relative"
    "typescript.suggest.autoImports" = $true
    "editor.formatOnSave" = $true
    "editor.codeActionsOnSave" = @{
        "source.fixAll.eslint" = $true
        "source.organizeImports" = $true
    }
    "files.associations" = @{
        "*.rs" = "rust"
        "*.toml" = "toml"
        "*.sql" = "sql"
    }
    "terminal.integrated.defaultProfile.windows" = "PowerShell"
    "git.enableSmartCommit" = $true
    "workbench.colorTheme" = "Default Dark+"
    "cursor.cpp.disabledLanguages" = @("cpp", "c")
    "cursor.general.enableAutoSave" = $true
    "cursor.general.enableAutoSaveOnFocusChange" = $true
}

# Créer le répertoire .vscode s'il n'existe pas
if (-not (Test-Path ".vscode")) {
    New-Item -ItemType Directory -Path ".vscode" -Force
}

# Sauvegarder les paramètres
$vscodeSettings | ConvertTo-Json -Depth 3 | Out-File -FilePath ".vscode/settings.json" -Encoding UTF8

Write-Host "✅ Paramètres VSCode/Cursor configurés" -ForegroundColor Green

# 2. Créer un fichier .cursorrules optimisé
$cursorRules = @"
# Règles Cursor pour Yukpomnang

## Contexte du projet
- **Backend**: Rust avec Axum, SQLx, PostgreSQL, pgvector
- **Frontend**: React avec TypeScript, TailwindCSS
- **Base de données**: PostgreSQL avec extensions pgvector et imgsmlr
- **Fonctionnalités**: Géolocalisation, géocodage, IA, WebSocket

## Règles de développement

### Backend Rust
1. Utiliser `Result<T, E>` pour la gestion d'erreurs
2. Implémenter des traits pour la réutilisabilité
3. Utiliser `async/await` pour les opérations asynchrones
4. Valider toutes les entrées utilisateur
5. Utiliser des enums pour les états
6. Optimiser les requêtes SQL avec des index appropriés

### Frontend React
1. Utiliser des hooks personnalisés pour la logique métier
2. Séparer la logique métier des composants UI
3. Utiliser des contextes React pour l'état global
4. Implémenter la gestion d'erreur robuste
5. Utiliser TypeScript strictement
6. Optimiser les re-renders avec useMemo/useCallback

### Base de données
1. Utiliser des migrations pour les changements de schéma
2. Créer des index pour les requêtes fréquentes
3. Utiliser des contraintes de clé étrangère
4. Optimiser les requêtes avec EXPLAIN
5. Utiliser des transactions pour les opérations complexes

### Géolocalisation
1. Valider les coordonnées GPS
2. Utiliser des services de géocodage fiables
3. Implémenter la mise en cache des résultats
4. Gérer les erreurs de géocodage gracieusement

### IA et WebSocket
1. Implémenter la gestion d'erreur pour les connexions WebSocket
2. Utiliser des timeouts pour les requêtes IA
3. Implémenter la reconnexion automatique
4. Valider les réponses IA avant traitement

## Commandes utiles
- Backend: `cargo run`, `cargo build`, `cargo test`, `cargo clippy`
- Frontend: `npm run dev`, `npm run build`, `npm run test`
- Base de données: `sqlx migrate run`, `psql -h localhost -U postgres -d yukpomnang`
- Tests: `cargo test`, `npm test`

## Structure des fichiers
- Backend: `src/controllers/`, `src/services/`, `src/models/`, `src/routes/`
- Frontend: `src/components/`, `src/pages/`, `src/hooks/`, `src/services/`
- Migrations: `backend/migrations/`
- Scripts: `scripts/`
- Configuration: `backend/config/`

## Sécurité
- Valider toutes les entrées utilisateur
- Utiliser des tokens JWT sécurisés
- Implémenter une authentification robuste
- Protéger les routes sensibles
- Chiffrer les données sensibles

## Performance
- Utiliser des index de base de données appropriés
- Implémenter la pagination
- Optimiser les requêtes SQL
- Utiliser la mise en cache quand approprié
- Minimiser les re-renders React
"@

$cursorRules | Out-File -FilePath ".cursorrules" -Encoding UTF8

Write-Host "✅ Règles Cursor configurées" -ForegroundColor Green

# 3. Installer les extensions recommandées
Write-Host "`n🔌 Installation des extensions recommandées..." -ForegroundColor Yellow

$extensions = @(
    "rust-lang.rust-analyzer",
    "serayuzgur.crates",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-mssql.mssql",
    "eamodio.gitlens",
    "rangav.vscode-thunder-client"
)

foreach ($extension in $extensions) {
    Write-Host "Installation de $extension..." -ForegroundColor Cyan
    cursor --install-extension $extension --silent
}

Write-Host "✅ Extensions installées" -ForegroundColor Green

# 4. Créer des raccourcis clavier personnalisés
Write-Host "`n⌨️ Configuration des raccourcis clavier..." -ForegroundColor Yellow

$keybindings = @(
    @{
        "key" = "ctrl+shift+r"
        "command" = "workbench.action.reloadWindow"
        "when" = "editorTextFocus"
    },
    @{
        "key" = "ctrl+shift+t"
        "command" = "workbench.action.terminal.new"
        "when" = "editorTextFocus"
    },
    @{
        "key" = "ctrl+shift+b"
        "command" = "workbench.action.tasks.runTask"
        "args" = "Build Backend"
        "when" = "editorTextFocus"
    }
)

$keybindings | ConvertTo-Json -Depth 3 | Out-File -FilePath ".vscode/keybindings.json" -Encoding UTF8

Write-Host "✅ Raccourcis clavier configurés" -ForegroundColor Green

Write-Host "`n🎉 Optimisation Cursor terminée !" -ForegroundColor Green
Write-Host "`n📋 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Redémarrez Cursor" -ForegroundColor White
Write-Host "2. Exécutez: .\dev-workflow.ps1" -ForegroundColor White
Write-Host "3. Commencez le développement !" -ForegroundColor White

