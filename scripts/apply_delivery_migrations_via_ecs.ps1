# Script pour appliquer les migrations via ECS Task (si base dans VPC privé)
param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "us-east-1",
    [string]$TaskDefinition = "yukpomnang-backend"
)

Write-Host "🚀 Application des migrations via ECS Task" -ForegroundColor Cyan
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

# Sauvegarder le SQL dans un fichier
$sqlFile = "scripts/delivery_migrations_temp.sql"
$migrationSQL | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "✅ Fichier SQL créé: $sqlFile" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Options d'exécution:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Exécuter via ECS Exec (si activé)" -ForegroundColor Cyan
Write-Host "  1. Trouver une tâche ECS en cours:" -ForegroundColor Gray
Write-Host "     aws ecs list-tasks --cluster $ClusterName --service-name $ServiceName --region $Region" -ForegroundColor White
Write-Host ""
Write-Host "  2. Exécuter la commande dans le conteneur:" -ForegroundColor Gray
Write-Host "     aws ecs execute-command --cluster $ClusterName --task <TASK_ID> --container backend --command 'psql \$DATABASE_URL -f /app/backend/scripts/delivery_migrations_temp.sql' --interactive" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Les migrations seront appliquées automatiquement au prochain redémarrage du backend" -ForegroundColor Cyan
Write-Host "  (via auto_migrate.rs au démarrage)" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Créer une tâche one-shot ECS pour exécuter les migrations" -ForegroundColor Cyan
Write-Host "  (voir scripts/run-migrations-ecs-task.ps1)" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 RECOMMANDATION:" -ForegroundColor Yellow
Write-Host "   Les migrations utilisent IF NOT EXISTS, donc elles sont idempotentes." -ForegroundColor Gray
Write-Host "   Elles seront appliquées automatiquement au prochain redémarrage du service backend." -ForegroundColor Gray
Write-Host "   Redémarrez simplement le service ECS pour appliquer les migrations." -ForegroundColor Gray
Write-Host ""



