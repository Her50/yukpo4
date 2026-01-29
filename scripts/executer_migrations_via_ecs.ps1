# Script PowerShell pour exécuter les migrations manquantes via ECS Task
# Usage: .\scripts\executer_migrations_via_ecs.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$TASK_DEFINITION = "yukpomnang-backend"
$SUBNET_IDS = @("subnet-xxx", "subnet-yyy")  # À remplacer par les vrais subnet IDs
$SECURITY_GROUP_ID = "sg-xxx"  # À remplacer par le vrai security group ID

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Execution des Migrations via ECS Task" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Méthode 1: Exécuter sqlx migrate run via une tâche ECS
Write-Host "Methode 1: Execution via sqlx migrate run..." -ForegroundColor Yellow

# Créer un script SQL temporaire avec toutes les migrations manquantes
$migrationSQL = @"
-- Migration manuelle pour créer les tables manquantes
-- Exécuté le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

-- 1. Créer live_sessions si elle n'existe pas
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    livekit_room_name TEXT,
    livekit_participant_identity TEXT,
    livekit_ingress_id TEXT,
    livekit_ingress_url TEXT,
    stream_key TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    fallback_rtmp_url TEXT,
    fallback_hls_url TEXT,
    current_viewers INTEGER NOT NULL DEFAULT 0,
    peak_viewers INTEGER NOT NULL DEFAULT 0,
    total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at);
CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id);

-- 2. Exécuter les migrations séparées
\i /app/backend/migrations/20260102_create_product_creation_queue.sql
\i /app/backend/migrations/20251111001_002_create_live_flash_sales.sql
\i /app/backend/migrations/20251115002_create_global_promo_platform.sql
\i /app/backend/migrations/20251115001_create_delivery_matching_tables.sql
\i /app/backend/migrations/20250120_001_add_order_preparation_system.sql
"@

# Sauvegarder le script SQL
$tempSQLFile = "temp_migrations_$(Get-Date -Format 'yyyyMMddHHmmss').sql"
$migrationSQL | Out-File -FilePath $tempSQLFile -Encoding UTF8

Write-Host "Script SQL cree: $tempSQLFile" -ForegroundColor Green
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Copiez ce fichier SQL dans votre conteneur ECS ou sur un serveur accessible à la base de données" -ForegroundColor White
Write-Host "2. Exécutez-le avec: psql \$DATABASE_URL -f $tempSQLFile" -ForegroundColor White
Write-Host ""
Write-Host "OU utilisez la méthode alternative ci-dessous..." -ForegroundColor Yellow
Write-Host ""

# Méthode 2: Utiliser sqlx migrate run directement
Write-Host "Methode 2: Execution directe via sqlx migrate run..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour executer les migrations via ECS, utilisez:" -ForegroundColor Cyan
Write-Host ""
Write-Host "aws ecs run-task \`" -ForegroundColor White
Write-Host "  --cluster $CLUSTER_NAME \`" -ForegroundColor White
Write-Host "  --task-definition $TASK_DEFINITION \`" -ForegroundColor White
Write-Host "  --launch-type FARGATE \`" -ForegroundColor White
Write-Host "  --network-configuration `"awsvpcConfiguration={subnets=[$($SUBNET_IDS -join ',')],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=DISABLED}`" \`" -ForegroundColor White
Write-Host "  --overrides `"{\`"containerOverrides\`":[{\`"name\`":\`"backend\`",\`"command\`":[\`"sqlx\`",\`"migrate\`",\`"run\`"]}]}\`"" -ForegroundColor White
Write-Host ""

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Script SQL sauvegarde dans: $tempSQLFile" -ForegroundColor Green
Write-Host "=================================================================================="

