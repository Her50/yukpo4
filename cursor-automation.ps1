# cursor-automation.ps1
# Script d'automatisation Cursor pour le projet Yukpomnang

Write-Host "🚀 Automatisation Cursor pour Yukpomnang" -ForegroundColor Green

# Fonction pour ouvrir des fichiers spécifiques
function Open-ProjectFiles {
    Write-Host "📂 Ouverture des fichiers clés du projet..." -ForegroundColor Yellow
    
    # Backend Rust
    cursor backend/src/main.rs
    cursor backend/src/controllers/auth_controller.rs
    cursor backend/src/services/app_ia.rs
    
    # Frontend React
    cursor frontend/src/App.tsx
    cursor frontend/src/components/location/LocationDisplay.tsx
    cursor frontend/src/pages/ResultatBesoin_clean.tsx
    
    # Configuration
    cursor backend/Cargo.toml
    cursor frontend/package.json
    cursor .cursorrules
}

# Fonction pour installer les extensions recommandées
function Install-RecommendedExtensions {
    Write-Host "🔌 Installation des extensions recommandées..." -ForegroundColor Yellow
    
    # Extensions Rust
    cursor --install-extension rust-lang.rust-analyzer
    cursor --install-extension serayuzgur.crates
    cursor --install-extension vadimcn.vscode-lldb
    
    # Extensions TypeScript/React
    cursor --install-extension ms-vscode.vscode-typescript-next
    cursor --install-extension bradlc.vscode-tailwindcss
    cursor --install-extension esbenp.prettier-vscode
    cursor --install-extension ms-vscode.vscode-eslint
    
    # Extensions base de données
    cursor --install-extension ms-mssql.mssql
    
    # Extensions Git
    cursor --install-extension eamodio.gitlens
    cursor --install-extension github.vscode-pull-request-github
    
    # Extensions API
    cursor --install-extension rangav.vscode-thunder-client
}

# Fonction pour ouvrir le projet complet
function Open-FullProject {
    Write-Host "📁 Ouverture du projet complet..." -ForegroundColor Yellow
    cursor .
}

# Fonction pour ouvrir des fichiers de configuration
function Open-ConfigFiles {
    Write-Host "⚙️ Ouverture des fichiers de configuration..." -ForegroundColor Yellow
    
    cursor backend/config/embedding.toml
    cursor backend/config/matching.toml
    cursor frontend/src/config/api.ts
    cursor .env
}

# Menu principal
Write-Host "`n📋 Menu d'automatisation Cursor:" -ForegroundColor Cyan
Write-Host "1. Ouvrir le projet complet" -ForegroundColor White
Write-Host "2. Ouvrir les fichiers clés" -ForegroundColor White
Write-Host "3. Ouvrir les fichiers de configuration" -ForegroundColor White
Write-Host "4. Installer les extensions recommandées" -ForegroundColor White
Write-Host "5. Ouvrir les fichiers de migration" -ForegroundColor White
Write-Host "6. Ouvrir les scripts PowerShell" -ForegroundColor White

$choice = Read-Host "`nChoisissez une option (1-6)"

switch ($choice) {
    "1" { Open-FullProject }
    "2" { Open-ProjectFiles }
    "3" { Open-ConfigFiles }
    "4" { Install-RecommendedExtensions }
    "5" { 
        Write-Host "📄 Ouverture des fichiers de migration..." -ForegroundColor Yellow
        cursor backend/migrations/
        cursor migration_tokens_1M.sql
        cursor migration_tokens_simple.sql
    }
    "6" { 
        Write-Host "🔧 Ouverture des scripts PowerShell..." -ForegroundColor Yellow
        cursor *.ps1
    }
    default { 
        Write-Host "❌ Option invalide" -ForegroundColor Red
    }
}

Write-Host "`n✅ Automatisation terminée !" -ForegroundColor Green

