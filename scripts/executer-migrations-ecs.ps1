# 🚀 Script pour exécuter les migrations SQLx dans AWS ECS
# Usage: .\scripts\executer-migrations-ecs.ps1

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$Region = "eu-west-1",
    [string]$ContainerName = "backend"
)

Write-Host "🚀 Exécution des migrations SQLx dans AWS ECS" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier AWS CLI
Write-Host "🔍 Vérification de AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✅ AWS CLI trouvé : $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI non trouvé. Installez-le depuis https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

# 2. Lister les tâches
Write-Host ""
Write-Host "🔍 Recherche des tâches en cours dans le cluster '$ClusterName'..." -ForegroundColor Yellow
try {
    $tasksJson = aws ecs list-tasks --cluster $ClusterName --region $Region 2>&1
    $tasks = $tasksJson | ConvertFrom-Json
    
    if ($tasks.taskArns.Count -eq 0) {
        Write-Host "❌ Aucune tâche trouvée dans le cluster '$ClusterName'" -ForegroundColor Red
        Write-Host "💡 Vérifiez que le service ECS est en cours d'exécution" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ $($tasks.taskArns.Count) tâche(s) trouvée(s)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la recherche des tâches : $_" -ForegroundColor Red
    Write-Host "💡 Vérifiez que le cluster existe et que vous avez les permissions" -ForegroundColor Yellow
    exit 1
}

# 3. Extraire le task ID
$taskArn = $tasks.taskArns[0]
$taskId = $taskArn.Split('/')[-1]
Write-Host "📋 Task ID : $taskId" -ForegroundColor Cyan

# 4. Activer Execute Command si nécessaire
Write-Host ""
Write-Host "🔧 Vérification/Activation de Execute Command..." -ForegroundColor Yellow
try {
    aws ecs update-cluster --cluster $ClusterName --enable-execute-command --region $Region | Out-Null
    Write-Host "✅ Execute Command activé" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Impossible d'activer Execute Command (peut-être déjà activé) : $_" -ForegroundColor Yellow
}

# 5. Afficher les instructions
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📝 INSTRUCTIONS POUR EXÉCUTER LES MIGRATIONS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Une fois connecté au conteneur, exécutez les commandes suivantes :" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Vérifier l'environnement :" -ForegroundColor White
Write-Host "   pwd" -ForegroundColor Gray
Write-Host "   ls -la /app/migrations/" -ForegroundColor Gray
Write-Host "   echo `$DATABASE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Installer sqlx-cli (si nécessaire) :" -ForegroundColor White
Write-Host "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y" -ForegroundColor Gray
Write-Host "   source `$HOME/.cargo/env" -ForegroundColor Gray
Write-Host "   cargo install sqlx-cli --features postgres --no-default-features" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Exécuter les migrations :" -ForegroundColor White
Write-Host "   cd /app" -ForegroundColor Gray
Write-Host "   sqlx migrate run --database-url `"`$DATABASE_URL`"" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Vérifier les migrations appliquées :" -ForegroundColor White
Write-Host "   sqlx query --database-url `"`$DATABASE_URL`" `"SELECT version, description, success FROM _sqlx_migrations ORDER BY version;`"" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Quitter le conteneur :" -ForegroundColor White
Write-Host "   exit" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 6. Demander confirmation
$confirmation = Read-Host "Voulez-vous vous connecter au conteneur maintenant ? (O/N)"
if ($confirmation -ne "O" -and $confirmation -ne "o" -and $confirmation -ne "Y" -and $confirmation -ne "y") {
    Write-Host "❌ Connexion annulée" -ForegroundColor Yellow
    exit 0
}

# 7. Se connecter au conteneur
Write-Host ""
Write-Host "🚀 Connexion au conteneur..." -ForegroundColor Cyan
Write-Host "💡 Utilisez 'exit' pour quitter le conteneur" -ForegroundColor Yellow
Write-Host ""

try {
    aws ecs execute-command `
        --cluster $ClusterName `
        --task $taskId `
        --container $ContainerName `
        --command "/bin/bash" `
        --interactive `
        --region $Region
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de la connexion : $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Vérifications à faire :" -ForegroundColor Yellow
    Write-Host "   1. Le service ECS a 'enableExecuteCommand = true'" -ForegroundColor White
    Write-Host "   2. Le rôle IAM de la tâche a les permissions Session Manager" -ForegroundColor White
    Write-Host "   3. AWS Systems Manager Session Manager est activé" -ForegroundColor White
    Write-Host "   4. Vous avez les permissions 'ecs:ExecuteCommand'" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✅ Déconnexion du conteneur" -ForegroundColor Green

