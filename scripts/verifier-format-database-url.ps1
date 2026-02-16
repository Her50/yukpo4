# 🔍 Vérifier le Format DATABASE_URL pour Cloud SQL

param(
    [string]$DatabaseUrl = ""
)

Write-Host "=== VÉRIFICATION FORMAT DATABASE_URL ===" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "❌ ERREUR: DATABASE_URL non fournie" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\verifier-format-database-url.ps1 -DatabaseUrl 'postgresql://...'" -ForegroundColor White
    exit 1
}

Write-Host "DATABASE_URL fournie (masquée):" -ForegroundColor Yellow
$masked = $DatabaseUrl -replace '://([^:]+):([^@]+)@', '://***:***@'
Write-Host "  $masked" -ForegroundColor Gray
Write-Host ""

# Vérifications
$errors = @()
$warnings = @()

# 1. Vérifier format général
if (-not $DatabaseUrl.StartsWith("postgresql://")) {
    $errors += "❌ Format invalide: doit commencer par 'postgresql://'"
}

# 2. Vérifier format Cloud SQL Unix socket
if ($DatabaseUrl -match '@/') {
    Write-Host "✅ Format Cloud SQL Unix socket détecté (@/)" -ForegroundColor Green
    
    # Vérifier host=/cloudsql/
    if ($DatabaseUrl -match 'host=/cloudsql/([^&]+)') {
        $connectionName = $matches[1]
        Write-Host "✅ Connection name trouvé: $connectionName" -ForegroundColor Green
        
        # Vérifier format PROJECT:REGION:INSTANCE
        $parts = $connectionName -split ':'
        if ($parts.Length -eq 3) {
            Write-Host "✅ Format connection name correct (PROJECT:REGION:INSTANCE)" -ForegroundColor Green
            Write-Host "   Project: $($parts[0])" -ForegroundColor Gray
            Write-Host "   Region: $($parts[1])" -ForegroundColor Gray
            Write-Host "   Instance: $($parts[2])" -ForegroundColor Gray
        } else {
            $errors += "❌ Format connection name invalide: doit être PROJECT:REGION:INSTANCE"
        }
    } else {
        $errors += "❌ Paramètre 'host=/cloudsql/...' manquant"
    }
    
    # Vérifier qu'il n'y a pas de host:port après @
    if ($DatabaseUrl -match '@([^/]+):(\d+)') {
        $warnings += "⚠️ Host:port détecté après @ - Format Unix socket ne devrait pas avoir de host:port"
    }
} else {
    $warnings += "⚠️ Format standard (IP/hostname) détecté - Cloud SQL Unix socket recommandé"
}

# 3. Vérifier présence user et password
if ($DatabaseUrl -match '://([^:]+):([^@]+)@') {
    $user = $matches[1]
    $password = $matches[2]
    Write-Host "✅ User trouvé: $user" -ForegroundColor Green
    if ([string]::IsNullOrEmpty($password)) {
        $warnings += "⚠️ Password vide ou manquant"
    } else {
        Write-Host "✅ Password présent (masqué)" -ForegroundColor Green
    }
} else {
    $errors += "❌ User ou password manquant"
}

# 4. Vérifier présence database
if ($DatabaseUrl -match '@/([^?]+)') {
    $database = $matches[1]
    Write-Host "✅ Database trouvée: $database" -ForegroundColor Green
} else {
    $errors += "❌ Database manquante"
}

# Afficher résultats
Write-Host ""
if ($errors.Count -gt 0) {
    Write-Host "=== ERREURS ===" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  $error" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "=== AVERTISSEMENTS ===" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($errors.Count -eq 0) {
    Write-Host "=== ✅ FORMAT VALIDE ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Format correct pour Cloud SQL Unix socket!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Format attendu:" -ForegroundColor Cyan
    Write-Host "  postgresql://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE" -ForegroundColor White
    Write-Host ""
    Write-Host "Exemple:" -ForegroundColor Cyan
    Write-Host "  postgresql://yukpo_user:MTeInD(Vw)b`$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" -ForegroundColor White
} else {
    Write-Host "=== ❌ FORMAT INVALIDE ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Corrigez les erreurs ci-dessus avant de mettre à jour le secret GitHub." -ForegroundColor Yellow
    exit 1
}

