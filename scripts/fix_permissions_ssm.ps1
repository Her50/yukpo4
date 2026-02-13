# Script PowerShell pour exécuter les commandes de permissions via SSM

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

Write-Host "📤 Envoi des commandes de correction des permissions à l'instance EC2..." -ForegroundColor Cyan

# Créer un script bash inline
$bashScript = @"
export PGPASSWORD='$dbPassword'
DB_HOST='yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com'
DB_USER='yukpo_admin'
DB_NAME='yukpo'

echo '🔍 Vérification et correction des permissions...'

# 1. Permissions sur la base
echo '1️⃣ Attribution des permissions sur la base...'
psql -h `$DB_HOST -U `$DB_USER -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE `"`$DB_NAME`" TO `"`$DB_USER`";" 2>&1

# 2. Permissions sur les tables existantes
echo '2️⃣ Attribution des permissions sur les tables...'
psql -h `$DB_HOST -U `$DB_USER -d `$DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO `"`$DB_USER`";" 2>&1
psql -h `$DB_HOST -U `$DB_USER -d `$DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO `"`$DB_USER`";" 2>&1

# 3. Permissions par défaut
echo '3️⃣ Attribution des permissions par défaut...'
psql -h `$DB_HOST -U `$DB_USER -d `$DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO `"`$DB_USER`";" 2>&1
psql -h `$DB_HOST -U `$DB_USER -d `$DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO `"`$DB_USER`";" 2>&1

# 4. Vérification finale
echo '4️⃣ Vérification finale...'
if psql -h `$DB_HOST -U `$DB_USER -d `$DB_NAME -c "SELECT current_database(), current_user;" 2>&1; then
    echo '✅ Toutes les permissions sont configurées correctement'
else
    echo '❌ Erreur lors de la vérification finale'
    exit 1
fi
"@

# Convertir en JSON pour AWS CLI
$commandsJson = $bashScript -split "`n" | ConvertTo-Json

# Envoyer la commande
Write-Host "Envoi de la commande SSM..." -ForegroundColor Yellow
$sendResult = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "{\"commands\":$commandsJson}" `
    --region $region `
    --output json | ConvertFrom-Json

$commandId = $sendResult.Command.CommandId
Write-Host "✅ Commande envoyée (ID: $commandId)" -ForegroundColor Green

# Attendre le résultat
Write-Host "⏳ Attente du résultat (15 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Récupérer le résultat
Write-Host "📥 Récupération du résultat..." -ForegroundColor Cyan
$result = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host ""
Write-Host "📋 Statut: $($result.Status)" -ForegroundColor $(if ($result.Status -eq "Success") { "Green" } else { "Red" })
Write-Host ""
Write-Host "📤 Sortie standard:" -ForegroundColor Cyan
Write-Host $result.StandardOutputContent
Write-Host ""
if ($result.StandardErrorContent) {
    Write-Host "⚠️ Erreurs:" -ForegroundColor Yellow
    Write-Host $result.StandardErrorContent
}

if ($result.Status -eq "Success") {
    Write-Host ""
    Write-Host "✅ Permissions configurées avec succès!" -ForegroundColor Green
    Write-Host "🔄 Redémarrez maintenant le service ECS:" -ForegroundColor Yellow
    Write-Host "   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ La commande a échoué. Vérifiez les erreurs ci-dessus." -ForegroundColor Red
}

