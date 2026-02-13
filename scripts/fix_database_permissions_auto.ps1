# Script PowerShell pour corriger automatiquement les permissions de la base de données yukpo
# Exécute les commandes via AWS Systems Manager (SSM) sur l'instance EC2

$ErrorActionPreference = "Stop"

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "Correction automatique des permissions de la base de donnees yukpo" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que AWS CLI est disponible
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host "AWS CLI detecte" -ForegroundColor Green
Write-Host ""

# Créer les commandes bash individuelles à exécuter
$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "echo 'Verification et correction des permissions...'",
    "echo ''",
    "echo '1. Verification de l''acces a la base...'",
    "psql -h $dbHost -U $dbUser -d $dbName -c 'SELECT current_database(), current_user;' || echo 'Probleme d''acces detecte'",
    "echo ''",
    "echo '2. Attribution des permissions sur la base...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"' + $dbName + '\" TO \"' + $dbUser + '\";"'),
    "echo 'Permissions sur la base accordees'",
    "echo ''",
    "echo '3. Attribution des permissions sur les tables existantes...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"' + $dbUser + '\";"'),
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"' + $dbUser + '\";"'),
    "echo 'Permissions sur les tables accordees'",
    "echo ''",
    "echo '4. Attribution des permissions par defaut...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"' + $dbUser + '\";"'),
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"' + $dbUser + '\";"'),
    "echo 'Permissions par defaut configurees'",
    "echo ''",
    "echo '5. Verification finale...'",
    "psql -h $dbHost -U $dbUser -d $dbName -c 'SELECT current_database(), current_user;'",
    "echo ''",
    "echo 'Toutes les permissions sont configurees correctement'",
    "echo 'Resume:'",
    "echo '   - Base de donnees: $dbName'",
    "echo '   - Utilisateur: $dbUser'",
    "echo '   - Permissions: OK'"
)

Write-Host "Envoi de la commande SSM a l'instance EC2..." -ForegroundColor Yellow
Write-Host "   Instance ID: $instanceId" -ForegroundColor Gray
Write-Host "   Region: $region" -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "Envoi de la commande..." -ForegroundColor Yellow
    
    # Créer le JSON pour les paramètres
    $paramsObject = @{
        commands = $commands
    }
    $paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10
    
    # Créer un fichier temporaire sans BOM
    $tempFile = [System.IO.Path]::GetTempFileName()
    # Utiliser UTF8 sans BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tempFile, $paramsJson, $utf8NoBom)
    
    # Convertir le chemin Windows en format Unix pour AWS CLI
    $tempFileUnix = $tempFile -replace '\\', '/'
    
    # Envoyer la commande SSM
    $sendCommandOutput = aws ssm send-command `
        --instance-ids $instanceId `
        --document-name "AWS-RunShellScript" `
        --parameters "file://$tempFileUnix" `
        --region $region `
        --output json 2>&1

    # Nettoyer le fichier temporaire
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'envoi de la commande SSM:" -ForegroundColor Red
        Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Sortie:" -ForegroundColor Red
        Write-Host $sendCommandOutput -ForegroundColor Red
        Write-Host ""
        Write-Host "JSON envoye:" -ForegroundColor Yellow
        Write-Host $paramsJson -ForegroundColor Gray
        exit 1
    }

    $sendResult = $sendCommandOutput | ConvertFrom-Json
    $commandId = $sendResult.Command.CommandId

    Write-Host "Commande envoyee avec succes" -ForegroundColor Green
    Write-Host "   Command ID: $commandId" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Attente de l'execution (20 secondes)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20

    # Récupérer le résultat
    Write-Host ""
    Write-Host "Recuperation du resultat..." -ForegroundColor Cyan
    Write-Host ""

    $invocationOutput = aws ssm get-command-invocation `
        --command-id $commandId `
        --instance-id $instanceId `
        --region $region `
        --output json 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de la recuperation du resultat:" -ForegroundColor Red
        Write-Host $invocationOutput -ForegroundColor Red
        exit 1
    }

    $invocation = $invocationOutput | ConvertFrom-Json

    # Afficher le statut
    $statusColor = if ($invocation.Status -eq "Success") { "Green" } else { "Red" }
    Write-Host "Statut: $($invocation.Status)" -ForegroundColor $statusColor
    Write-Host ""

    # Afficher la sortie standard
    if ($invocation.StandardOutputContent) {
        Write-Host "Sortie standard:" -ForegroundColor Cyan
        Write-Host $invocation.StandardOutputContent
        Write-Host ""
    }

    # Afficher les erreurs si présentes
    if ($invocation.StandardErrorContent) {
        Write-Host "Erreurs:" -ForegroundColor Yellow
        Write-Host $invocation.StandardErrorContent
        Write-Host ""
    }

    # Résultat final
    if ($invocation.Status -eq "Success") {
        Write-Host "Permissions configurees avec succes!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaine etape: Redemarrer le service ECS" -ForegroundColor Yellow
        Write-Host "   Executez cette commande:" -ForegroundColor White
        Write-Host "   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1" -ForegroundColor Cyan
    } else {
        Write-Host "La commande a echoue. Verifiez les erreurs ci-dessus." -ForegroundColor Red
        Write-Host ""
        Write-Host "Conseil: Connectez-vous manuellement a l'instance EC2 via Session Manager" -ForegroundColor Yellow
        Write-Host "   et executez les commandes manuellement pour plus de details." -ForegroundColor Yellow
        exit 1
    }

} catch {
    Write-Host "Erreur inattendue:" -ForegroundColor Red
    Write-Host "Message: $_" -ForegroundColor Red
    Write-Host "Exception Type: $($_.Exception.GetType().FullName)" -ForegroundColor Red
    if ($_.Exception.Message) {
        Write-Host "Exception Message: $($_.Exception.Message)" -ForegroundColor Red
    }
    if ($_.Exception.InnerException) {
        Write-Host "Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
    Write-Host "Stack Trace:" -ForegroundColor Yellow
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}
