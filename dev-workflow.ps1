# dev-workflow.ps1
# Workflow de développement efficace pour Yukpomnang

Write-Host "🚀 Workflow de développement Yukpomnang" -ForegroundColor Green

# Vérifier l'environnement
Write-Host "`n🔍 Vérification de l'environnement..." -ForegroundColor Yellow

# Vérifier Rust
try {
    $rustVersion = rustc --version
    Write-Host "✅ Rust: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Rust non installé" -ForegroundColor Red
}

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non installé" -ForegroundColor Red
}

# Vérifier PostgreSQL
try {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL non installé" -ForegroundColor Red
}

# Vérifier Cursor CLI
try {
    $cursorVersion = cursor --version
    Write-Host "✅ Cursor CLI: $cursorVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Cursor CLI non disponible" -ForegroundColor Red
}

# Menu de développement
Write-Host "`n📋 Menu de développement:" -ForegroundColor Cyan
Write-Host "1. 🚀 Démarrer le backend (Rust)" -ForegroundColor White
Write-Host "2. 🌐 Démarrer le frontend (React)" -ForegroundColor White
Write-Host "3. 🗄️ Gérer la base de données" -ForegroundColor White
Write-Host "4. 🔧 Ouvrir Cursor avec le projet" -ForegroundColor White
Write-Host "5. 📊 Vérifier l'état du projet" -ForegroundColor White
Write-Host "6. 🧹 Nettoyer et reconstruire" -ForegroundColor White
Write-Host "7. 🚀 Démarrage complet (Backend + Frontend)" -ForegroundColor White

$choice = Read-Host "`nChoisissez une option (1-7)"

switch ($choice) {
    "1" { 
        Write-Host "🚀 Démarrage du backend Rust..." -ForegroundColor Yellow
        Set-Location backend
        cargo run
    }
    "2" { 
        Write-Host "🌐 Démarrage du frontend React..." -ForegroundColor Yellow
        Set-Location frontend
        npm run dev
    }
    "3" { 
        Write-Host "🗄️ Gestion de la base de données..." -ForegroundColor Yellow
        Write-Host "Options disponibles:" -ForegroundColor Cyan
        Write-Host "a. Vérifier la connexion" -ForegroundColor White
        Write-Host "b. Exécuter les migrations" -ForegroundColor White
        Write-Host "c. Ouvrir psql" -ForegroundColor White
        
        $dbChoice = Read-Host "Choisissez (a/b/c)"
        switch ($dbChoice) {
            "a" { psql -h localhost -U postgres -d yukpomnang -c "SELECT version();" }
            "b" { sqlx migrate run }
            "c" { psql -h localhost -U postgres -d yukpomnang }
        }
    }
    "4" { 
        Write-Host "🔧 Ouverture de Cursor..." -ForegroundColor Yellow
        cursor .
    }
    "5" { 
        Write-Host "📊 État du projet..." -ForegroundColor Yellow
        
        # Vérifier les dépendances
        Write-Host "`n📦 Backend (Rust):" -ForegroundColor Cyan
        Set-Location backend
        cargo check --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Backend: OK" -ForegroundColor Green
        } else {
            Write-Host "❌ Backend: Erreurs détectées" -ForegroundColor Red
        }
        
        Write-Host "`n📦 Frontend (React):" -ForegroundColor Cyan
        Set-Location ../frontend
        npm list --depth=0 --silent
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Frontend: OK" -ForegroundColor Green
        } else {
            Write-Host "❌ Frontend: Erreurs détectées" -ForegroundColor Red
        }
        
        Set-Location ..
    }
    "6" { 
        Write-Host "🧹 Nettoyage et reconstruction..." -ForegroundColor Yellow
        
        # Nettoyer le backend
        Write-Host "Nettoyage backend..." -ForegroundColor Cyan
        Set-Location backend
        cargo clean
        cargo build
        
        # Nettoyer le frontend
        Write-Host "Nettoyage frontend..." -ForegroundColor Cyan
        Set-Location ../frontend
        npm ci
        npm run build
        
        Set-Location ..
        Write-Host "✅ Nettoyage terminé" -ForegroundColor Green
    }
    "7" { 
        Write-Host "🚀 Démarrage complet..." -ForegroundColor Yellow
        
        # Démarrer le backend en arrière-plan
        Write-Host "Démarrage du backend..." -ForegroundColor Cyan
        Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal
        
        # Attendre un peu
        Start-Sleep -Seconds 3
        
        # Démarrer le frontend
        Write-Host "Démarrage du frontend..." -ForegroundColor Cyan
        Set-Location frontend
        npm run dev
    }
    default { 
        Write-Host "❌ Option invalide" -ForegroundColor Red
    }
}

Write-Host "`n✅ Workflow terminé !" -ForegroundColor Green

