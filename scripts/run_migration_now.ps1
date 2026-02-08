# Script temporaire pour exécuter les migrations directement
$dbUrl = "postgresql://yukpo_db_user:3NKcAegavL959K3@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"

# Extraire les informations de connexion
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5] -replace '\?.*',''
    
    Write-Host "🚀 Application des migrations sur AWS PostgreSQL" -ForegroundColor Cyan
    Write-Host "   Host: $dbHost" -ForegroundColor Gray
    Write-Host "   Database: $dbName" -ForegroundColor Gray
    Write-Host ""
    
    # SQL de migration
    $migrationSQL = @"
-- Migration 1: Ajouter preparation_time_minutes
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days 
ON product_delivery_config USING GIN(availability_days);

-- Migration 2: Ajouter storage_location_id
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location 
ON product_delivery_config(storage_location_id) 
WHERE storage_location_id IS NOT NULL;

-- Vérification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN ('preparation_time_minutes', 'storage_location_id', 'max_preparation_time_minutes', 'availability_days', 'is_immediately_available')
ORDER BY column_name;
"@
    
    # Écrire dans un fichier temporaire
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $migrationSQL | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        # Exécuter avec psql
        $env:PGPASSWORD = $dbPassword
        Write-Host "🔄 Exécution des migrations..." -ForegroundColor Yellow
        $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $tempFile 2>&1
        
        Write-Host ""
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Résultat:" -ForegroundColor Cyan
            Write-Host $result
        } else {
            Write-Host "❌ Erreur lors de l'application:" -ForegroundColor Red
            Write-Host $result
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
}



