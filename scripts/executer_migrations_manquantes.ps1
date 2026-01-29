# Script PowerShell pour exécuter manuellement les migrations manquantes
# Usage: .\scripts\executer_migrations_manquantes.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Execution Manuelle des Migrations Manquantes" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# 1. Récupérer DATABASE_URL depuis SSM
Write-Host "Etape 1: Recuperation de DATABASE_URL..." -ForegroundColor Yellow
try {
    $databaseUrl = aws ssm get-parameter `
        --name $SSM_DATABASE_URL_PATH `
        --region $REGION `
        --with-decryption `
        --query 'Parameter.Value' `
        --output text
    
    if (-not $databaseUrl) {
        Write-Host "❌ Impossible de récupérer DATABASE_URL depuis SSM" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "OK: DATABASE_URL recuperee" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

# Extraire les informations de connexion
if ($databaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    $env:PGPASSWORD = $dbPassword
    
    # 2. Vérifier les tables de dépendance critiques
    Write-Host "Etape 2: Verification des tables de dependance..." -ForegroundColor Yellow
    
    $dependencyTables = @("live_sessions", "couriers", "delivery_parcels", "delivery_zones", "parcel_types")
    $dependencyQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('$($dependencyTables -join "','")') ORDER BY table_name;"
    $existingDependencies = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $dependencyQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
    
    Write-Host "Tables de dependance existantes:" -ForegroundColor Cyan
    foreach ($dep in $dependencyTables) {
        if ($existingDependencies -contains $dep) {
            Write-Host "   OK $dep" -ForegroundColor Green
        } else {
            Write-Host "   MANQUANTE $dep" -ForegroundColor Red
        }
    }
    Write-Host ""
    
    # 3. Créer les tables de dépendance manquantes depuis la migration 0
    Write-Host "Etape 3: Creation des tables de dependance manquantes..." -ForegroundColor Yellow
    
    # Vérifier si live_sessions existe, sinon la créer
    if ($existingDependencies -notcontains "live_sessions") {
        Write-Host "   Creation de live_sessions..." -ForegroundColor Yellow
        $liveSessionsSQL = "CREATE TABLE IF NOT EXISTS live_sessions (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, service_id INTEGER REFERENCES services(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, status VARCHAR(32) NOT NULL DEFAULT 'scheduled', start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ, livekit_room_name TEXT, livekit_participant_identity TEXT, livekit_ingress_id TEXT, livekit_ingress_url TEXT, stream_key TEXT, webrtc_url TEXT, hls_url TEXT, fallback_rtmp_url TEXT, fallback_hls_url TEXT, current_viewers INTEGER NOT NULL DEFAULT 0, peak_viewers INTEGER NOT NULL DEFAULT 0, total_watch_time_seconds BIGINT NOT NULL DEFAULT 0, metadata JSONB DEFAULT '{}'::JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status); CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at); CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id);"
        echo $liveSessionsSQL | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK live_sessions creee" -ForegroundColor Green
        } else {
            Write-Host "   Attention: Erreur lors de la creation de live_sessions (peut deja exister)" -ForegroundColor Yellow
        }
    }
    
    # Vérifier si parcel_types existe, sinon la créer
    if ($existingDependencies -notcontains "parcel_types") {
        Write-Host "   Creation de parcel_types..." -ForegroundColor Yellow
        $parcelTypesSQL = "CREATE TABLE IF NOT EXISTS parcel_types (id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, description TEXT, max_weight_kg NUMERIC(6,2), max_volume_cm3 NUMERIC(12,2), requires_isothermal BOOLEAN DEFAULT FALSE, requires_fragile_handling BOOLEAN DEFAULT FALSE, requires_secure_box BOOLEAN DEFAULT FALSE, requires_document_protection BOOLEAN DEFAULT FALSE, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now()); CREATE UNIQUE INDEX IF NOT EXISTS idx_parcel_types_slug ON parcel_types(slug);"
        echo $parcelTypesSQL | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK parcel_types creee" -ForegroundColor Green
        } else {
            Write-Host "   Attention: Erreur lors de la creation de parcel_types" -ForegroundColor Yellow
        }
    }
    
    # Vérifier si couriers existe, sinon la créer (nécessite l'ENUM delivery_courier_status)
    if ($existingDependencies -notcontains "couriers") {
        Write-Host "   Creation de couriers..." -ForegroundColor Yellow
        $couriersSQL = "DO `$`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_courier_status') THEN CREATE TYPE delivery_courier_status AS ENUM ('pending_review', 'active', 'suspended', 'inactive', 'rejected'); END IF; END `$`$; CREATE TABLE IF NOT EXISTS couriers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, application_id UUID, status delivery_courier_status NOT NULL DEFAULT 'pending_review', rating_average NUMERIC(3,2) DEFAULT 0, rating_count INTEGER DEFAULT 0, bio TEXT, hired_at TIMESTAMPTZ, suspended_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());"
        echo $couriersSQL | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK couriers creee" -ForegroundColor Green
        } else {
            Write-Host "   Attention: Erreur lors de la creation de couriers" -ForegroundColor Yellow
        }
    }
    
    # Vérifier si delivery_parcels existe, sinon la créer
    if ($existingDependencies -notcontains "delivery_parcels") {
        Write-Host "   Creation de delivery_parcels..." -ForegroundColor Yellow
        $deliveryParcelsSQL = "CREATE TABLE IF NOT EXISTS delivery_parcels (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL, weight_kg NUMERIC(6,2), volume_cm3 NUMERIC(12,2), declared_value NUMERIC(10,2), notes TEXT, photos JSONB DEFAULT '[]'::jsonb, constraints JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now());"
        echo $deliveryParcelsSQL | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   OK delivery_parcels creee" -ForegroundColor Green
        } else {
            Write-Host "   Attention: Erreur lors de la creation de delivery_parcels" -ForegroundColor Yellow
        }
    }
    
    # Vérifier si deliveries existe, sinon la créer
    $deliveriesExists = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries');" 2>&1 | Out-String
    if ($deliveriesExists -notmatch "t|true") {
        Write-Host "   Creation de deliveries..." -ForegroundColor Yellow
        # Utiliser le fichier SQL directement au lieu d'une chaîne multi-ligne
        $deliveriesSQLFile = "backend/migrations/20251110005_104_create_delivery_core.sql"
        if (Test-Path $deliveriesSQLFile) {
            Get-Content $deliveriesSQLFile -Raw | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK deliveries creee" -ForegroundColor Green
            } else {
                Write-Host "   Attention: Erreur lors de la creation de deliveries" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   Attention: Fichier de migration deliveries introuvable, creation manuelle..." -ForegroundColor Yellow
            $deliveriesSQL = "DO `$`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN CREATE TYPE delivery_status AS ENUM ('requested', 'confirmed', 'accepted', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_cancel_reason') THEN CREATE TYPE delivery_cancel_reason AS ENUM ('client_cancelled', 'courier_cancelled', 'timeout', 'no_courier_available', 'other'); END IF; END `$`$; CREATE TABLE IF NOT EXISTS deliveries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL, parcel_id UUID NOT NULL REFERENCES delivery_parcels(id) ON DELETE CASCADE, status delivery_status NOT NULL DEFAULT 'requested', requested_at TIMESTAMPTZ DEFAULT now(), confirmed_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, picked_up_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, cancel_reason delivery_cancel_reason, pickup_location GEOGRAPHY(Point, 4326) NOT NULL, dropoff_location GEOGRAPHY(Point, 4326) NOT NULL, pickup_address TEXT, dropoff_address TEXT, recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, recipient_contact_name TEXT, recipient_contact_phone TEXT, recipient_notes TEXT, recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(), recipient_dropoff_override GEOGRAPHY(Point, 4326), recipient_dropoff_address TEXT, recipient_dropoff_updated_at TIMESTAMPTZ, recipient_chat_thread_id UUID, distance_meters INTEGER, estimated_duration_seconds INTEGER, actual_duration_seconds INTEGER, updated_at TIMESTAMPTZ DEFAULT now(), pricing_id UUID, tracking_token UUID UNIQUE DEFAULT gen_random_uuid(), metadata JSONB DEFAULT '{}'::jsonb, shopping_required BOOLEAN DEFAULT FALSE, store_location GEOGRAPHY(Point, 4326), store_name TEXT); CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries(status, requested_at DESC); CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id); CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries(creator_id);"
            echo $deliveriesSQL | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK deliveries creee" -ForegroundColor Green
            } else {
                Write-Host "   Attention: Erreur lors de la creation de deliveries" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    
    # 4. Exécuter les migrations séparées dans l'ordre
    Write-Host "Etape 4: Execution des migrations separees..." -ForegroundColor Yellow
    
    $migrations = @(
        @{
            Name = "product_creation_queue"
            File = "backend/migrations/20260102_create_product_creation_queue.sql"
            Description = "Queue asynchrone pour création de produits"
        },
        @{
            Name = "live_flash_sales"
            File = "backend/migrations/20251111001_002_create_live_flash_sales.sql"
            Description = "Flash sales pour live sessions"
        },
        @{
            Name = "global_promo_events"
            File = "backend/migrations/20251115002_create_global_promo_platform.sql"
            Description = "Plateforme centralisée pour promos globales"
        },
        @{
            Name = "delivery_matching_queue"
            File = "backend/migrations/20251115001_create_delivery_matching_tables.sql"
            Description = "Tables de matching delivery"
        },
        @{
            Name = "product_orders"
            File = "backend/migrations/20250120_001_add_order_preparation_system.sql"
            Description = "Système de commandes produits"
        }
    )
    
    foreach ($migration in $migrations) {
        Write-Host "   Execution: $($migration.Description)..." -ForegroundColor Yellow
        
        if (Test-Path $migration.File) {
            Get-Content $migration.File -Raw | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK $($migration.Name) creee avec succes" -ForegroundColor Green
            } else {
                Write-Host "   Attention: Erreur lors de l'execution de $($migration.Name) (peut deja exister)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ERREUR: Fichier de migration introuvable: $($migration.File)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    
    # 5. Vérifier que toutes les tables critiques existent maintenant
    Write-Host "Etape 5: Verification finale..." -ForegroundColor Yellow
    
    $criticalTables = @(
        "product_creation_queue",
        "live_flash_sales",
        "global_promo_events",
        "delivery_matching_queue",
        "product_orders",
        "deliveries",
        "social_publication_jobs",
        "video_generation_jobs"
    )
    
    $verificationQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('$($criticalTables -join "','")') ORDER BY table_name;"
    $existingTables = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $verificationQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
    
    Write-Host "Tables critiques:" -ForegroundColor Cyan
    $allExist = $true
    foreach ($table in $criticalTables) {
        if ($existingTables -contains $table) {
            Write-Host "   OK $table" -ForegroundColor Green
        } else {
            Write-Host "   MANQUANTE $table" -ForegroundColor Red
            $allExist = $false
        }
    }
    Write-Host ""
    
    if ($allExist) {
        Write-Host "OK: Toutes les tables critiques existent maintenant !" -ForegroundColor Green
    } else {
        Write-Host "Attention: Certaines tables sont encore manquantes. Verifiez les erreurs ci-dessus." -ForegroundColor Yellow
    }
    
} else {
    Write-Host "ERREUR: Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "OK: Execution terminee" -ForegroundColor Green
Write-Host "=================================================================================="

