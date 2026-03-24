# Configuration des variables d'environnement YukpoIA manquantes
# Ce script configure les valeurs par défaut pour faire fonctionner le chat IA

Write-Host "🔧 Configuration YukpoIA Environment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Variables par défaut pour YukpoIA
$envVars = @{
    "YUKPO_IA_BILLING_ENABLED" = "true"
    "YUKPO_IA_DAILY_FREE_TOKEN_BUDGET" = "8000"
    "YUKPO_IA_TOKEN_MULTIPLIER" = "1.0"
    "YUKPO_IA_WHISPER_BILL_UNITS" = "200"
    "YUKPO_IA_QUEUE_WORKER_ENABLED" = "true"
}

Write-Host "`n📋 Configuration des variables:" -ForegroundColor Yellow

foreach ($var in $envVars.GetEnumerator()) {
    $name = $var.Key
    $value = $var.Value
    
    # Vérifier si la variable existe déjà
    $currentValue = [System.Environment]::GetEnvironmentVariable($name)
    if ($currentValue) {
        Write-Host "  ⚠️ $name déjà configurée: $currentValue" -ForegroundColor Yellow
    } else {
        # Configurer la variable pour la session actuelle
        [System.Environment]::SetEnvironmentVariable($name, $value, "User")
        Write-Host "  ✅ $name = $value" -ForegroundColor Green
    }
}

Write-Host "`n🔍 Vérification OpenAI API Key:" -ForegroundColor Yellow
$openaiKey = [System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY")
if ($openaiKey) {
    Write-Host "  ✅ OPENAI_API_KEY configurée" -ForegroundColor Green
} else {
    Write-Host "  ❌ OPENAI_API_KEY manquante - Configurez-la dans .env" -ForegroundColor Red
}

Write-Host "`n🚀 Redémarrage nécessaire:" -ForegroundColor Yellow
Write-Host "  1. Redémarrez votre terminal/IDE" -ForegroundColor Gray
Write-Host "  2. Relancez le backend avec: cargo run" -ForegroundColor Gray
Write-Host "  3. Testez le chat IA" -ForegroundColor Gray

Write-Host "`n✨ Configuration terminée !" -ForegroundColor Cyan
