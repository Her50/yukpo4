#!/usr/bin/env pwsh

# Script de diagnostic rapide pour YukpoIA Chat
# Vérifie l'état du système et identifie les problèmes courants

Write-Host "🔍 Diagnostic YukpoIA Chat System" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 1. Vérifier les variables d'environnement
Write-Host "`n📋 Variables d'environnement:" -ForegroundColor Yellow
$envVars = @(
    "YUKPO_IA_BILLING_ENABLED",
    "YUKPO_IA_DAILY_FREE_TOKEN_BUDGET", 
    "YUKPO_IA_TOKEN_MULTIPLIER",
    "OPENAI_API_KEY"
)

foreach ($var in $envVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var)
    if ($value) {
        if ($var -eq "OPENAI_API_KEY") {
            Write-Host "  ✅ $var = ***$(if ($value.Length -gt 10) { $value.Substring(0,10) + "..." } else { "***" })" -ForegroundColor Green
        } else {
            Write-Host "  ✅ $var = $value" -ForegroundColor Green
        }
    } else {
        Write-Host "  ❌ $var = (non défini)" -ForegroundColor Red
    }
}

# 2. Vérifier la compilation
Write-Host "`n🔧 Compilation:" -ForegroundColor Yellow
try {
    $compileResult = cargo check 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Compilation réussie" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Erreur de compilation:" -ForegroundColor Red
        $compileResult | Select-String -Pattern "error" | ForEach-Object { Write-Host "     $_" -ForegroundColor Red }
    }
} catch {
    Write-Host "  ❌ Impossible de vérifier la compilation: $_" -ForegroundColor Red
}

# 3. Vérifier les services critiques
Write-Host "`n🏥 Services système:" -ForegroundColor Yellow

# Vérifier PostgreSQL (si disponible)
try {
    $pgResult = psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ PostgreSQL disponible: $($pgResult.Split()[2])" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ PostgreSQL non disponible localement" -ForegroundColor Yellow
}

# Vérifier les tables requises
Write-Host "`n📊 Tables de données requises:" -ForegroundColor Yellow
$requiredTables = @(
    "users",
    "yukpo_ia_daily_usage",
    "yukpo_ia_sessions", 
    "yukpo_ia_messages"
)

foreach ($table in $requiredTables) {
    Write-Host "  🔍 $table" -ForegroundColor Cyan
}

# 4. Tests de base
Write-Host "`n🧪 Tests de configuration:" -ForegroundColor Yellow

# Test de facturation
$billingEnabled = [System.Environment]::GetEnvironmentVariable("YUKPO_IA_BILLING_ENABLED")
if ($billingEnabled -eq "1" -or $billingEnabled -eq "true") {
    Write-Host "  ✅ Facturation YukpoIA activée" -ForegroundColor Green
    
    $budget = [System.Environment]::GetEnvironmentVariable("YUKPO_IA_DAILY_FREE_TOKEN_BUDGET")
    if ($budget) {
        Write-Host "  📊 Quota gratuit: $budget unités/jour" -ForegroundColor Green
    } else {
        Write-Host "  📊 Quota gratuit: 8000 unités/jour (défaut)" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Facturation YukpoIA désactivée" -ForegroundColor Yellow
}

# Test OpenAI
$openaiKey = [System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY")
if ($openaiKey) {
    Write-Host "  ✅ Clé OpenAI configurée" -ForegroundColor Green
} else {
    Write-Host "  ❌ Clé OpenAI manquante" -ForegroundColor Red
}

# 5. Actions recommandées
Write-Host "`n🎯 Actions recommandées:" -ForegroundColor Yellow

if (-not $openaiKey) {
    Write-Host "  🔑 Configurer OPENAI_API_KEY" -ForegroundColor Red
}

if ($billingEnabled -and -not $budget) {
    Write-Host "  💰 Configurer YUKPO_IA_DAILY_FREE_TOKEN_BUDGET" -ForegroundColor Yellow
}

Write-Host "`n✨ Diagnostic terminé !" -ForegroundColor Cyan
Write-Host "Pour tester le chat: curl -X POST http://localhost:3000/api/ai/chat -H 'Content-Type: application/json' -d '{\"message\":\"Test\",\"type\":\"chat\"}'" -ForegroundColor Gray
