# Script simple pour exécuter les commandes de permissions via SSM

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"

Write-Host "Envoi des commandes de correction des permissions..." -ForegroundColor Cyan

# Créer le fichier JSON pour les paramètres
$commands = @(
    "export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d postgres -c 'GRANT ALL PRIVILEGES ON DATABASE yukpo TO yukpo_admin;'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yukpo_admin;'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yukpo_admin;'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO yukpo_admin;'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO yukpo_admin;'",
    "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'SELECT current_database(), current_user;'"
)

$params = @{
    commands = $commands
} | ConvertTo-Json -Compress

# Envoyer la commande
$result = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters $params `
    --region $region `
    --output json | ConvertFrom-Json

$commandId = $result.Command.CommandId
Write-Host "Commande envoyee (ID: $commandId)" -ForegroundColor Green
Write-Host "Attente du resultat (20 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Récupérer le résultat
$invocation = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host ""
Write-Host "Statut: $($invocation.Status)" -ForegroundColor $(if ($invocation.Status -eq "Success") { "Green" } else { "Red" })
Write-Host ""
Write-Host "Sortie:" -ForegroundColor Cyan
Write-Host $invocation.StandardOutputContent

if ($invocation.StandardErrorContent) {
    Write-Host ""
    Write-Host "Erreurs:" -ForegroundColor Yellow
    Write-Host $invocation.StandardErrorContent
}

if ($invocation.Status -eq "Success") {
    Write-Host ""
    Write-Host "Permissions configurees avec succes!" -ForegroundColor Green
    Write-Host "Redemarrez maintenant le service ECS:" -ForegroundColor Yellow
    Write-Host "aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1"
}

