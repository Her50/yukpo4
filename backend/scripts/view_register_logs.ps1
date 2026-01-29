# Script pour voir les logs de création de compte en temps réel
param(
    [string]$LogGroup = "/ecs/yukpomnang-backend",
    [string]$Region = "us-east-1",
    [int]$Minutes = 30
)

Write-Host "🔍 Consultation des logs de création de compte..." -ForegroundColor Cyan
Write-Host "Log Group: $LogGroup" -ForegroundColor Yellow
Write-Host "Région: $Region" -ForegroundColor Yellow
Write-Host "Période: Dernières $Minutes minutes" -ForegroundColor Yellow
Write-Host ""

# Vérifier que AWS CLI est disponible
try {
    $null = aws --version 2>&1
} catch {
    Write-Host "❌ AWS CLI non trouvé. Installez AWS CLI pour utiliser ce script." -ForegroundColor Red
    exit 1
}

# Vérifier le log group existe
Write-Host "🔍 Vérification du log group..." -ForegroundColor Yellow
$logGroups = aws logs describe-log-groups --region $Region --query "logGroups[?contains(logGroupName, 'yukpomnang') || contains(logGroupName, 'backend') || contains(logGroupName, 'ecs')].logGroupName" --output text 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($logGroups)) {
    Write-Host "⚠️  Log group '$LogGroup' non trouvé. Recherche des log groups disponibles..." -ForegroundColor Yellow
    $allLogGroups = aws logs describe-log-groups --region $Region --query "logGroups[].logGroupName" --output text 2>&1
    if ($allLogGroups) {
        Write-Host "Log groups disponibles:" -ForegroundColor Cyan
        $allLogGroups -split "`t" | Where-Object { $_ -match "yukpomnang|backend|ecs" } | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
    }
    Write-Host ""
    Write-Host "💡 Utilisez le bon nom de log group avec -LogGroup" -ForegroundColor Yellow
    exit 1
}

# Trouver le bon log group
$actualLogGroup = $logGroups -split "`t" | Where-Object { $_ -match "yukpomnang|backend" } | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($actualLogGroup)) {
    $actualLogGroup = $LogGroup
}

Write-Host "✅ Utilisation du log group: $actualLogGroup" -ForegroundColor Green
Write-Host ""

# Afficher les logs de registration
Write-Host "📋 Logs de création de compte (register_user) des dernières $Minutes minutes:" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

$since = "${Minutes}m"
$logs = aws logs tail $actualLogGroup --since $since --region $Region 2>&1

if ($LASTEXITCODE -eq 0) {
    $registerLogs = $logs | Select-String "register_user"
    
    if ($registerLogs) {
        $registerLogs | ForEach-Object {
            $line = $_.Line
            if ($line -match "ERROR|❌|error") {
                Write-Host $line -ForegroundColor Red
            } elseif ($line -match "✅|OK|success") {
                Write-Host $line -ForegroundColor Green
            } else {
                Write-Host $line -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "⚠️  Aucun log de création de compte trouvé dans les dernières $Minutes minutes" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "💡 Essayez de créer un compte maintenant, puis relancez ce script" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Erreur lors de la récupération des logs: $logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Afficher les erreurs générales
Write-Host "📋 Toutes les erreurs des dernières $Minutes minutes:" -ForegroundColor Cyan
Write-Host ""

$errorLogs = $logs | Select-String "ERROR|❌|error" | Select-Object -First 20

if ($errorLogs) {
    $errorLogs | ForEach-Object {
        Write-Host $_.Line -ForegroundColor Red
    }
} else {
    Write-Host "✅ Aucune erreur trouvée dans les logs récents" -ForegroundColor Green
}

Write-Host ""
Write-Host "💡 Pour voir les logs en temps réel:" -ForegroundColor Cyan
Write-Host "   aws logs tail $actualLogGroup --follow --region $Region | Select-String 'register_user'" -ForegroundColor Gray

