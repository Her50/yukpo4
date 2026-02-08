# Script pour appliquer les corrections SQL directement via ECS Task
# Utilise des commandes SQL courtes pour eviter la limite de 8192 caracteres

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$TaskDefinition = "yukpomnang-backend:3",
    [string]$Region = "us-east-1"
)

Write-Host "Application des corrections SQL via ECS Task" -ForegroundColor Cyan
Write-Host ""

$databaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Fonction pour executer une commande SQL via ECS Task
function Execute-SQLCommand {
    param([string]$sqlCommand)
    
    # Utiliser DATABASE_URL qui est deja dans le conteneur (via secrets SSM)
    # Ne pas passer DATABASE_URL dans environment pour eviter les problemes avec les secrets SSM
    $bashCmd = "export PGPASSWORD=`$(echo `$DATABASE_URL | grep -oP '://[^:]+:\K[^@]+'); psql `$DATABASE_URL -c `"$sqlCommand`""
    $cmdBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($bashCmd))
    
    $overrides = @{
        containerOverrides = @(
            @{
                name = "backend"
                command = @("sh", "-c", "echo '$cmdBase64' | base64 -d | sh")
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    $tempFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
    [System.IO.File]::WriteAllText($tempFile, $overrides, [System.Text.UTF8Encoding]::new($false))
    
    try {
        $taskOutput = aws ecs run-task --region $Region --cluster $ClusterName --task-definition $TaskDefinition --launch-type FARGATE --network-configuration $networkConfig --overrides file://$tempFile --query 'tasks[0].taskArn' --output text 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $taskOutput -notmatch "error") {
            Write-Host "  Task creee: $taskOutput" -ForegroundColor Gray
            return $taskOutput
        } else {
            Write-Host "  Erreur: $taskOutput" -ForegroundColor Red
            return $null
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

# 1. Creer la table user_saved_addresses
Write-Host "1. Creation de la table user_saved_addresses..." -ForegroundColor Yellow
$sql1 = "CREATE TABLE IF NOT EXISTS user_saved_addresses (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label VARCHAR(100) NOT NULL, address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')), address TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, location_data JSONB DEFAULT '{}'::jsonb, contact_name VARCHAR(255), contact_phone VARCHAR(50), instructions TEXT, building_number VARCHAR(50), floor VARCHAR(50), apartment VARCHAR(50), is_default_pickup BOOLEAN DEFAULT FALSE, is_default_dropoff BOOLEAN DEFAULT FALSE, usage_count INTEGER DEFAULT 0, last_used_at TIMESTAMPTZ, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id, label))"
Execute-SQLCommand -sqlCommand $sql1 | Out-Null

# 2. Creer les index
Write-Host "2. Creation des index..." -ForegroundColor Yellow
$indexes = @(
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id ON user_saved_addresses(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_type ON user_saved_addresses(user_id, address_type)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_default ON user_saved_addresses(user_id, is_default_pickup, is_default_dropoff)",
    "CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_active ON user_saved_addresses(user_id, is_active)"
)

foreach ($idx in $indexes) {
    Execute-SQLCommand -sqlCommand $idx | Out-Null
}

# 3. Creer les fonctions
Write-Host "3. Creation des fonctions..." -ForegroundColor Yellow

# Fonction calculate_vector_match_score_optimized
$func1 = "CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(vector_normalized TEXT[], search_keywords_normalized TEXT[]) RETURNS REAL AS `$`$ DECLARE match_count INTEGER; total_elements INTEGER; score REAL; BEGIN SELECT COUNT(*) INTO match_count FROM unnest(vector_normalized) AS elem WHERE elem = ANY(search_keywords_normalized); total_elements := array_length(vector_normalized, 1); IF total_elements IS NULL OR total_elements = 0 THEN RETURN 0.0; END IF; score := (match_count::REAL / total_elements::REAL) * 100.0; RETURN score; END; `$`$ LANGUAGE plpgsql IMMUTABLE"
Execute-SQLCommand -sqlCommand $func1 | Out-Null

# Fonction calculate_best_vector_match_score
$func2 = "CREATE OR REPLACE FUNCTION calculate_best_vector_match_score(characteristic_vector_normalized TEXT[], full_vector_normalized TEXT[], search_keywords_normalized TEXT[]) RETURNS REAL AS `$`$ SELECT GREATEST(COALESCE(calculate_vector_match_score_optimized(characteristic_vector_normalized, search_keywords_normalized), 0.0), COALESCE(calculate_vector_match_score_optimized(full_vector_normalized, search_keywords_normalized), 0.0)) `$`$ LANGUAGE sql IMMUTABLE"
Execute-SQLCommand -sqlCommand $func2 | Out-Null

# Fonction product_combination_exists
$func3 = "CREATE OR REPLACE FUNCTION product_combination_exists(p_product_vector TEXT[]) RETURNS BOOLEAN AS `$`$ DECLARE v_exists BOOLEAN; BEGIN SELECT EXISTS(SELECT 1 FROM autocomplete_combinations WHERE product_vector = p_product_vector) INTO v_exists; RETURN v_exists; END; `$`$ LANGUAGE plpgsql STABLE"
Execute-SQLCommand -sqlCommand $func3 | Out-Null

# 4. Corriger l'index pour la vue materialisee
Write-Host "4. Correction de l'index pour la vue materialisee..." -ForegroundColor Yellow
$sql4 = "DO `$`$ BEGIN IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique; CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique ON services_search_optimized_v2 (service_id); END IF; END `$`$"
Execute-SQLCommand -sqlCommand $sql4 | Out-Null

Write-Host ""
Write-Host "Corrections SQL appliquees via ECS Tasks!" -ForegroundColor Green
Write-Host "Les taches ECS sont en cours d'execution. Verifiez les logs pour confirmer l'execution." -ForegroundColor Yellow

