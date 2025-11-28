# Script de configuration des intervalles de monitoring
# Ce script génère les commandes pour configurer les variables sur Render.com

Write-Host "🔧 CONFIGURATION DES INTERVALLES DE MONITORING" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Configuration standard (recommandée pour production normale)
$standardConfig = @{
    "DB_HEALTH_CHECK_INTERVAL_SECS"          = "30"
    "PIPELINE_HEALTH_CHECK_INTERVAL_SECS"    = "300"
    "DELIVERY_MATCHING_WORKER_INTERVAL_SECS" = "30"
    "DELIVERY_MATCHING_WORKER_BATCH_SIZE"    = "10"
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS"   = "30"
    "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS"    = "60"
    "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS" = "60"
}

# Configuration charge élevée
$highLoadConfig = @{
    "DB_HEALTH_CHECK_INTERVAL_SECS"          = "60"
    "PIPELINE_HEALTH_CHECK_INTERVAL_SECS"    = "600"
    "DELIVERY_MATCHING_WORKER_INTERVAL_SECS" = "60"
    "DELIVERY_MATCHING_WORKER_BATCH_SIZE"    = "20"
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS"   = "60"
    "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS"    = "120"
    "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS" = "120"
}

Write-Host "📋 Choisissez une configuration :" -ForegroundColor Yellow
Write-Host "1. Configuration Standard (Production normale)" -ForegroundColor Cyan
Write-Host "2. Configuration Charge Élevée" -ForegroundColor Cyan
Write-Host "3. Configuration Personnalisée" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Votre choix (1-3)"

$selectedConfig = if ($choice -eq "1") {
    $standardConfig
}
elseif ($choice -eq "2") {
    $highLoadConfig
}
else {
    Write-Host "`n📝 Configuration personnalisée :" -ForegroundColor Yellow
    $customConfig = @{}
    foreach ($key in $standardConfig.Keys) {
        $defaultValue = $standardConfig[$key]
        $value = Read-Host "  $key (défaut: $defaultValue)"
        $customConfig[$key] = if ([string]::IsNullOrWhiteSpace($value)) { $defaultValue } else { $value }
    }
    $customConfig
}

Write-Host "`n✅ Configuration sélectionnée :" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
foreach ($var in $selectedConfig.GetEnumerator()) {
    Write-Host "  $($var.Key) = $($var.Value)" -ForegroundColor White
}

Write-Host "`n📋 INSTRUCTIONS POUR RENDER.COM :" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Allez sur https://dashboard.render.com" -ForegroundColor Cyan
Write-Host "2. Sélectionnez votre service backend" -ForegroundColor Cyan
Write-Host "3. Cliquez sur l'onglet 'Environment'" -ForegroundColor Cyan
Write-Host "4. Ajoutez les variables suivantes :" -ForegroundColor Cyan
Write-Host ""

foreach ($var in $selectedConfig.GetEnumerator()) {
    Write-Host "   Key: $($var.Key)" -ForegroundColor White
    Write-Host "   Value: $($var.Value)" -ForegroundColor Green
    Write-Host "   Secret: ❌ Non" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "5. Cliquez sur 'Save Changes'" -ForegroundColor Cyan
Write-Host "6. Redémarrez le service (Manual Deploy > Deploy latest commit)" -ForegroundColor Cyan
Write-Host ""

# Option : Générer un fichier .env pour développement local
$generateLocal = Read-Host "Voulez-vous générer un fichier .env pour développement local ? (O/N)"
if ($generateLocal -eq "O" -or $generateLocal -eq "o") {
    $envContent = "# Configuration des intervalles de monitoring`n"
    $envContent += "# Généré le $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"
    
    foreach ($var in $selectedConfig.GetEnumerator()) {
        $envContent += "$($var.Key)=$($var.Value)`n"
    }
    
    $envPath = "backend\.env.monitoring"
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    
    Write-Host "`n✅ Fichier créé : $envPath" -ForegroundColor Green
    Write-Host "   Vous pouvez copier ces variables dans votre fichier .env principal" -ForegroundColor Gray
}

Write-Host "`n✨ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Rappel : Ces variables sont OPTIONNELLES." -ForegroundColor Yellow
Write-Host "   Si elles ne sont pas configurées, les valeurs par défaut seront utilisées." -ForegroundColor Yellow
Write-Host ""

