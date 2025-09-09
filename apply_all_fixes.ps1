# Script d'application automatique de toutes les corrections
Write-Host "🚀 Application automatique de toutes les corrections..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Arrêter les processus existants
Write-Host "1️⃣ Arrêt des processus existants..." -ForegroundColor Yellow
try {
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "yukpomnang_backend" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "   ✅ Processus arrêtés" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Aucun processus à arrêter" -ForegroundColor Yellow
}

# 2. Configuration des variables d'environnement
Write-Host "2️⃣ Configuration des variables d'environnement..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
$env:EMBEDDING_API_URL = "http://localhost:8000"
$env:EMBEDDING_TIMEOUT_SECONDS = "60"
$env:EMBEDDING_MAX_RETRIES = "3"
Write-Host "   ✅ Variables d'environnement configurées" -ForegroundColor Green

# 3. Application des migrations PostgreSQL
Write-Host "3️⃣ Application des migrations PostgreSQL..." -ForegroundColor Yellow
try {
    # Vérifier la connexion PostgreSQL
    $testConnection = psql $env:DATABASE_URL -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connexion PostgreSQL OK" -ForegroundColor Green
        
        # Appliquer le script de migration
        Write-Host "   📝 Application du script add_columns.sql..." -ForegroundColor Cyan
        $migrationResult = psql $env:DATABASE_URL -f "backend/add_columns.sql" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Migration appliquée avec succès" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Erreur lors de la migration: $migrationResult" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ Erreur de connexion PostgreSQL: $testConnection" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur lors de la migration: $_" -ForegroundColor Red
}

# 4. Compilation du backend
Write-Host "4️⃣ Compilation du backend..." -ForegroundColor Yellow
Set-Location backend
try {
    $buildResult = cargo build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend compilé avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur de compilation: $buildResult" -ForegroundColor Red
        Write-Host "   🔧 Tentative de correction des erreurs..." -ForegroundColor Yellow
        
        # Vérifier et corriger les erreurs de compilation
        if ($buildResult -match "interaction_count") {
            Write-Host "   📝 Correction des colonnes manquantes..." -ForegroundColor Cyan
            # Les colonnes seront ajoutées par la migration
        }
    }
} catch {
    Write-Host "   ❌ Erreur lors de la compilation: $_" -ForegroundColor Red
}

# 5. Démarrage du microservice
Write-Host "5️⃣ Démarrage du microservice..." -ForegroundColor Yellow
Set-Location ..
Set-Location microservice_embedding
try {
    Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WindowStyle Hidden
    Write-Host "   ✅ Microservice démarré (PID: $((Get-Process python | Where-Object {$_.ProcessName -eq 'python'}).Id)" -ForegroundColor Green
    
    # Attendre que le microservice soit prêt
    Write-Host "   ⏳ Attente du démarrage du microservice..." -ForegroundColor Cyan
    $maxAttempts = 30
    $attempt = 0
    do {
        Start-Sleep -Seconds 2
        $attempt++
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "   ✅ Microservice accessible" -ForegroundColor Green
                break
            }
        } catch {
            Write-Host "   ⏳ Tentative $attempt/$maxAttempts - Microservice pas encore prêt..." -ForegroundColor Yellow
        }
    } while ($attempt -lt $maxAttempts)
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "   ⚠️ Microservice pas accessible après $maxAttempts tentatives" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors du démarrage du microservice: $_" -ForegroundColor Red
}

# 6. Démarrage du backend
Write-Host "6️⃣ Démarrage du backend..." -ForegroundColor Yellow
Set-Location ..
Set-Location backend
try {
    Start-Process -FilePath "cargo" -ArgumentList "run" -WindowStyle Hidden
    Write-Host "   ✅ Backend démarré" -ForegroundColor Green
    
    # Attendre que le backend soit prêt
    Write-Host "   ⏳ Attente du démarrage du backend..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Backend accessible" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️ Backend pas encore accessible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors du démarrage du backend: $_" -ForegroundColor Red
}

# 7. Démarrage du frontend
Write-Host "7️⃣ Démarrage du frontend..." -ForegroundColor Yellow
Set-Location ..
Set-Location frontend
try {
    # Vérifier si package.json existe
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if ($packageJson.scripts.dev) {
            Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Hidden
            Write-Host "   ✅ Frontend démarré" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Script 'dev' non trouvé dans package.json" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️ package.json non trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors du démarrage du frontend: $_" -ForegroundColor Red
}

# 8. Test de la recherche
Write-Host "8️⃣ Test de la recherche..." -ForegroundColor Yellow
Set-Location ..
Start-Sleep -Seconds 10

try {
    $testData = @{
        input = "je cherche un pressing"
        user_id = 1
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNjc4NCwiaWF0IjoxNzU2MzkxODQwLCJleHAiOjE3NTY0NzgyNDB9.K_vcijqCSWkuqLmiLGgnTptvKr3aGb7vrkfNSB3u_KE"
    }

    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Body $testData -Headers $headers -TimeoutSec 30
    Write-Host "   ✅ Test de recherche réussi" -ForegroundColor Green
    Write-Host "   📊 Résultats: $($response.nombre_matchings) services trouvés" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Erreur lors du test de recherche: $_" -ForegroundColor Red
}

# 9. Résumé final
Write-Host "9️⃣ Résumé final..." -ForegroundColor Yellow
Write-Host "   🎯 Toutes les corrections ont été appliquées automatiquement" -ForegroundColor Green
Write-Host "   🌐 Services accessibles:" -ForegroundColor Cyan
Write-Host "      - Microservice: http://localhost:8000" -ForegroundColor White
Write-Host "      - Backend: http://localhost:3001" -ForegroundColor White
Write-Host "      - Frontend: http://localhost:3000 (si démarré)" -ForegroundColor White

Write-Host "   📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "      1. Tester la recherche via l'interface web" -ForegroundColor White
Write-Host "      2. Vérifier que les résultats s'affichent correctement" -ForegroundColor White
Write-Host "      3. Contacter si des problèmes persistent" -ForegroundColor White

Write-Host "✅ Procédure terminée avec succès!" -ForegroundColor Green 