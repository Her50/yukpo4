# Script pour appliquer la migration des types de colis directement
# Usage: .\scripts\apply_parcel_types_migration.ps1

$ErrorActionPreference = "Stop"

# Charger les variables d'environnement depuis .env si disponible
if (Test-Path ".\.env") {
    Get-Content ".\.env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Host "❌ DATABASE_URL non définie. Définissez-la dans .env ou comme variable d'environnement." -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Application de la migration des types de colis..." -ForegroundColor Cyan

# Extraire les informations de connexion depuis DATABASE_URL
if ($DATABASE_URL -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "📊 Connexion à: $dbHost:$dbPort/$dbName" -ForegroundColor Yellow
    
    # Vérifier si psql est disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "❌ psql n'est pas installé ou n'est pas dans le PATH." -ForegroundColor Red
        Write-Host "💡 Installez PostgreSQL client ou utilisez Docker: docker run -it --rm postgres psql" -ForegroundColor Yellow
        exit 1
    }
    
    # SQL de migration
    $migrationSQL = @"
-- Migration: Aligner parcel_types avec les types de véhicules des coursiers
-- Date: 2025-12-22

-- 1. Supprimer les anciens parcel_types qui ne correspondent pas aux véhicules
DELETE FROM parcel_types WHERE slug NOT IN (
    'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
);

-- 2. Insérer les types de colis alignés avec delivery_engine_type
INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
VALUES
    ('bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
    ('motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
    ('tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
    ('car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
    ('pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
    ('van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
    ('truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
    ('walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_weight_kg = EXCLUDED.max_weight_kg,
    max_volume_cm3 = EXCLUDED.max_volume_cm3,
    metadata = EXCLUDED.metadata;

-- 3. Afficher les types après migration
SELECT id, slug, display_name, description FROM parcel_types ORDER BY id;
"@
    
    # Exécuter la migration
    $env:PGPASSWORD = $dbPassword
    Write-Host "`n🔄 Exécution de la migration..." -ForegroundColor Yellow
    
    $migrationSQL | & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "`n📦 Types de colis disponibles:" -ForegroundColor Cyan
        $query = "SELECT id, slug, display_name FROM parcel_types ORDER BY id;"
        $query | & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F " | "
    } else {
        Write-Host "`n❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host "❌ Format DATABASE_URL invalide. Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Red
    exit 1
}



