# Script pour corriger le problème de détection de la base de données
# Donne les permissions nécessaires pour que l'application puisse vérifier l'existence de la base

$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"

Write-Host "Correction du probleme de detection de la base de donnees" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Créer le script bash avec des commandes individuelles (évite les problèmes de fins de ligne)
$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "echo '1. Verification de l''existence de la base (avant permissions)...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT datname FROM pg_database WHERE datname = ''' + $dbName + ''';" 2>&1'),
    "echo ''",
    "echo '2. Test de connexion directe a la base yukpo...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT current_database(), current_user;" 2>&1 && echo "OK: Connexion directe fonctionne" || echo "ERREUR: Connexion directe echoue"'),
    "echo ''",
    "echo '3. Attribution des permissions pour interroger pg_database...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "GRANT SELECT ON pg_database TO ' + $dbUser + ';" 2>&1'),
    "echo ''",
    "echo '4. Verification apres attribution des permissions...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d postgres -c "SELECT datname FROM pg_database WHERE datname = ''' + $dbName + ''';" 2>&1'),
    "echo ''",
    "echo '5. Verification finale de la connexion...'",
    ('psql -h ' + $dbHost + ' -U ' + $dbUser + ' -d ' + $dbName + ' -c "SELECT current_database(), current_user, version();" 2>&1 && echo "SUCCES: Tout fonctionne correctement" || echo "ERREUR: La connexion echoue toujours"')
)

# Créer le fichier JSON pour SSM
$paramsObject = @{
    commands = $commands
}
$paramsJson = $paramsObject | ConvertTo-Json -Compress -Depth 10

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tempFile, $paramsJson, $utf8NoBom)

$tempFileUnix = $tempFile -replace '\\', '/'

Write-Host "Envoi de la commande SSM..." -ForegroundColor Yellow

$sendCommandOutput = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFileUnix" `
    --region $region `
    --output json 2>&1

Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de l'envoi de la commande: $sendCommandOutput" -ForegroundColor Red
    exit 1
}

$sendResult = $sendCommandOutput | ConvertFrom-Json
$commandId = $sendResult.Command.CommandId

Write-Host "Commande envoyee (ID: $commandId)" -ForegroundColor Green
Write-Host "Attente de 20 secondes..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Récupérer le résultat
$invocationOutput = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la recuperation du resultat: $invocationOutput" -ForegroundColor Red
    exit 1
}

$invocation = $invocationOutput | ConvertFrom-Json

Write-Host ""
Write-Host "Resultat:" -ForegroundColor Cyan
Write-Host "=========" -ForegroundColor Cyan
Write-Host ""
Write-Host "Statut: $($invocation.Status)" -ForegroundColor $(if ($invocation.Status -eq "Success") { "Green" } else { "Red" })
Write-Host ""
Write-Host "Sortie standard:" -ForegroundColor Cyan
Write-Host $invocation.StandardOutputContent

if ($invocation.StandardErrorContent) {
    Write-Host ""
    Write-Host "Erreurs:" -ForegroundColor Yellow
    Write-Host $invocation.StandardErrorContent
}

if ($invocation.Status -eq "Success") {
    Write-Host ""
    Write-Host "SUCCES! Les permissions ont ete configurees." -ForegroundColor Green
    Write-Host "L'application devrait maintenant pouvoir detecter la base de donnees." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "La commande a echoue. Verifiez les erreurs ci-dessus." -ForegroundColor Red
}

