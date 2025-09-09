# Script de migration de la base de données PostgreSQL
Write-Host "🗄️ Migration de la base de données PostgreSQL..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# Configuration de la connexion
$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

# 1. Vérifier la connexion PostgreSQL
Write-Host "1️⃣ Vérification de la connexion PostgreSQL..." -ForegroundColor Yellow
try {
    $testResult = psql $env:DATABASE_URL -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connexion PostgreSQL OK" -ForegroundColor Green
        Write-Host "   📊 $testResult" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Erreur de connexion: $testResult" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier l'existence de la table services
Write-Host "2️⃣ Vérification de la table services..." -ForegroundColor Yellow
try {
    $tableCheck = psql $env:DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services');" 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($tableCheck -match "t") {
            Write-Host "   ✅ Table services existe" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Table services n'existe pas" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "   ❌ Erreur lors de la vérification: $tableCheck" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification: $_" -ForegroundColor Red
    exit 1
}

# 3. Vérifier les colonnes existantes
Write-Host "3️⃣ Vérification des colonnes existantes..." -ForegroundColor Yellow
try {
    $columnsCheck = psql $env:DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('interaction_count', 'rating_avg', 'rating_count');" 2>&1
    Write-Host "   📊 Colonnes existantes: $columnsCheck" -ForegroundColor Cyan
} catch {
    Write-Host "   ⚠️ Erreur lors de la vérification des colonnes: $_" -ForegroundColor Yellow
}

# 4. Appliquer les migrations
Write-Host "4️⃣ Application des migrations..." -ForegroundColor Yellow

# Migration 1: Ajouter interaction_count
Write-Host "   📝 Ajout de interaction_count..." -ForegroundColor Cyan
try {
    $result1 = psql $env:DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ interaction_count ajouté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur interaction_count: $result1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur interaction_count: $_" -ForegroundColor Yellow
}

# Migration 2: Ajouter rating_avg
Write-Host "   📝 Ajout de rating_avg..." -ForegroundColor Cyan
try {
    $result2 = psql $env:DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2) DEFAULT 0.0;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ rating_avg ajouté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur rating_avg: $result2" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur rating_avg: $_" -ForegroundColor Yellow
}

# Migration 3: Ajouter rating_count
Write-Host "   📝 Ajout de rating_count..." -ForegroundColor Cyan
try {
    $result3 = psql $env:DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ rating_count ajouté" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur rating_count: $result3" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur rating_count: $_" -ForegroundColor Yellow
}

# 5. Créer les index
Write-Host "5️⃣ Création des index..." -ForegroundColor Yellow

# Index pour interaction_count
Write-Host "   📝 Index interaction_count..." -ForegroundColor Cyan
try {
    $index1 = psql $env:DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_services_interaction_count ON services(interaction_count);" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Index interaction_count créé" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur index interaction_count: $index1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur index interaction_count: $_" -ForegroundColor Yellow
}

# Index pour rating_avg
Write-Host "   📝 Index rating_avg..." -ForegroundColor Cyan
try {
    $index2 = psql $env:DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_services_rating_avg ON services(rating_avg);" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Index rating_avg créé" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur index rating_avg: $index2" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur index rating_avg: $_" -ForegroundColor Yellow
}

# Index pour rating_count
Write-Host "   📝 Index rating_count..." -ForegroundColor Cyan
try {
    $index3 = psql $env:DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_services_rating_count ON services(rating_count);" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Index rating_count créé" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Erreur index rating_count: $index3" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur index rating_count: $_" -ForegroundColor Yellow
}

# 6. Vérification finale
Write-Host "6️⃣ Vérification finale..." -ForegroundColor Yellow
try {
    $finalCheck = psql $env:DATABASE_URL -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('interaction_count', 'rating_avg', 'rating_count') ORDER BY column_name;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Vérification finale réussie" -ForegroundColor Green
        Write-Host "   📊 Colonnes ajoutées:" -ForegroundColor Cyan
        Write-Host "$finalCheck" -ForegroundColor White
    } else {
        Write-Host "   ❌ Erreur lors de la vérification finale: $finalCheck" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification finale: $_" -ForegroundColor Red
}

# 7. Test de données
Write-Host "7️⃣ Test de données..." -ForegroundColor Yellow
try {
    $dataTest = psql $env:DATABASE_URL -c "SELECT COUNT(*) as total_services, AVG(interaction_count) as avg_interaction, AVG(rating_avg) as avg_rating FROM services;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Test de données réussi" -ForegroundColor Green
        Write-Host "   📊 Statistiques: $dataTest" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️ Erreur lors du test de données: $dataTest" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Erreur lors du test de données: $_" -ForegroundColor Yellow
}

Write-Host "✅ Migration de la base de données terminée!" -ForegroundColor Green 