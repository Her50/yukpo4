# Script pour appliquer les migrations de configuration de livraison sur AWS PostgreSQL
# Migrations: preparation_time_minutes et storage_location_id

param(
    [string]$DatabaseUrl = "",
    [string]$AwsRegion = "us-east-1"
)

Write-Host "🚀 Application des migrations de configuration de livraison sur AWS PostgreSQL" -ForegroundColor Cyan
Write-Host ""

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez PostgreSQL client: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

# Si DATABASE_URL n'est pas fourni, essayer de le récupérer depuis les variables d'environnement
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    $DatabaseUrl = $env:DATABASE_URL
    if ([string]::IsNullOrEmpty($DatabaseUrl)) {
        Write-Host "❌ DATABASE_URL n'est pas défini" -ForegroundColor Red
        Write-Host "💡 Fournissez DATABASE_URL comme paramètre ou variable d'environnement" -ForegroundColor Yellow
        Write-Host "   Exemple: .\apply_delivery_config_migrations_aws.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/db'" -ForegroundColor Gray
        exit 1
    }
}

Write-Host "✅ DATABASE_URL trouvé" -ForegroundColor Green
Write-Host ""

# Créer un fichier temporaire avec les migrations SQL
$migrationFile = [System.IO.Path]::GetTempFileName() + ".sql"
$migrationContent = @"
-- Migration 1: Ajouter preparation_time_minutes et colonnes associées
-- Date: 2025-01-20

-- 1. Ajouter colonnes à product_delivery_config
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;

-- 2. Index pour recherche par jours de disponibilité
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- Migration 2: Ajouter storage_location_id
-- Date: 2026-01-30

-- Ajouter la colonne storage_location_id si elle n'existe pas déjà
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location 
ON product_delivery_config(storage_location_id) 
WHERE storage_location_id IS NOT NULL;

-- Vérification: Afficher les colonnes créées
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN ('preparation_time_minutes', 'storage_location_id', 'max_preparation_time_minutes', 'availability_days', 'is_immediately_available')
ORDER BY column_name;
"@

try {
    # Écrire le contenu dans le fichier temporaire
    $migrationContent | Out-File -FilePath $migrationFile -Encoding UTF8
    Write-Host "📝 Fichier de migration créé: $migrationFile" -ForegroundColor Cyan
    
    # Extraire les informations de connexion depuis DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    if ($DatabaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $dbUser = $matches[1]
        $dbPassword = $matches[2]
        $dbHost = $matches[3]
        $dbPort = $matches[4]
        $dbName = $matches[5]
        
        Write-Host "🔌 Connexion à la base de données..." -ForegroundColor Cyan
        Write-Host "   Host: $dbHost" -ForegroundColor Gray
        Write-Host "   Port: $dbPort" -ForegroundColor Gray
        Write-Host "   Database: $dbName" -ForegroundColor Gray
        Write-Host "   User: $dbUser" -ForegroundColor Gray
        Write-Host ""
        
        # Définir la variable d'environnement PGPASSWORD pour éviter la demande interactive
        $env:PGPASSWORD = $dbPassword
        
        # Exécuter les migrations
        Write-Host "🔄 Application des migrations..." -ForegroundColor Yellow
        $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Résultat:" -ForegroundColor Cyan
            Write-Host $result
        } else {
            Write-Host ""
            Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
            Write-Host $result
            exit 1
        }
    } else {
        Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
        Write-Host "   Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer: supprimer le fichier temporaire
    if (Test-Path $migrationFile) {
        Remove-Item $migrationFile -Force
        Write-Host ""
        Write-Host "🧹 Fichier temporaire supprimé" -ForegroundColor Gray
    }
    
    # Nettoyer la variable d'environnement
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✨ Terminé!" -ForegroundColor Green



