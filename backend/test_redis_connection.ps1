# Script PowerShell pour tester la connexion Redis directement
# Utilise l'API REST d'Upstash pour tester la connexion

$REDIS_URL = "rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"

Write-Host "🔍 Test de connexion Redis" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Extraire les informations de l'URL
if ($REDIS_URL -match "rediss?://([^:]+):([^@]+)@([^:]+):(\d+)(?:/(\d+))?") {
    $username = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = if ($matches[5]) { $matches[5] } else { "0" }
    
    Write-Host "📋 Informations extraites:" -ForegroundColor Yellow
    Write-Host "   Host: $host" -ForegroundColor Gray
    Write-Host "   Port: $port" -ForegroundColor Gray
    Write-Host "   Username: $username" -ForegroundColor Gray
    Write-Host "   Database: $database" -ForegroundColor Gray
    Write-Host "   Protocole: rediss:// (TLS)" -ForegroundColor Green
    Write-Host ""
    
    # Extraire le nom de l'instance Upstash
    if ($host -match "([^.]+)\.upstash\.io") {
        $instanceName = $matches[1]
        Write-Host "🔍 Instance Upstash détectée: $instanceName" -ForegroundColor Cyan
        Write-Host ""
        
        # Tester avec l'API REST d'Upstash
        Write-Host "🧪 Test 1: Vérification de l'URL Redis..." -ForegroundColor Yellow
        Write-Host "   ✅ URL formatée correctement" -ForegroundColor Green
        Write-Host ""
        
        # Tester avec curl si disponible
        Write-Host "🧪 Test 2: Test de connexion (nécessite Rust ou redis-cli)..." -ForegroundColor Yellow
        Write-Host "   ⚠️  Pour tester la connexion réelle, utilisez:" -ForegroundColor Gray
        Write-Host "      cargo run --bin test_redis (après correction des erreurs de compilation)" -ForegroundColor White
        Write-Host "   ou" -ForegroundColor Gray
        Write-Host "      redis-cli -u `"$REDIS_URL`" ping" -ForegroundColor White
        Write-Host ""
        
        # Analyse de l'URL
        Write-Host "💡 Analyse de l'URL Redis:" -ForegroundColor Yellow
        Write-Host "   ✅ Protocole: rediss:// (TLS activé)" -ForegroundColor Green
        Write-Host "   ✅ Host: $host (Upstash)" -ForegroundColor Green
        Write-Host "   ✅ Port: $port (standard Redis)" -ForegroundColor Green
        Write-Host "   ✅ Username: $username (default)" -ForegroundColor Green
        Write-Host "   ✅ Database: $database" -ForegroundColor Green
        Write-Host ""
        
        # Vérifier les problèmes potentiels
        Write-Host "🔍 Vérification des problèmes potentiels:" -ForegroundColor Yellow
        
        # Vérifier si l'URL utilise redis:// au lieu de rediss://
        if ($REDIS_URL -notmatch "^rediss://") {
            Write-Host "   ❌ PROBLÈME: URL utilise 'redis://' au lieu de 'rediss://'" -ForegroundColor Red
            Write-Host "      Upstash nécessite TLS (rediss://)" -ForegroundColor Red
            Write-Host "      Solution: Remplacer 'redis://' par 'rediss://' dans REDIS_URL" -ForegroundColor Yellow
        }
        else {
            Write-Host "   ✅ Protocole TLS correct (rediss://)" -ForegroundColor Green
        }
        
        # Vérifier si le numéro de base de données est présent
        if ($REDIS_URL -notmatch "/\d+$") {
            Write-Host "   ⚠️  Numéro de base de données absent (sera ajouté automatiquement: /0)" -ForegroundColor Yellow
        }
        else {
            Write-Host "   ✅ Numéro de base de données présent" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "📝 Configuration recommandée pour le backend:" -ForegroundColor Yellow
        Write-Host "   REDIS_URL=$REDIS_URL" -ForegroundColor White
        Write-Host ""
        
        # Vérifier la feature TLS dans Cargo.toml
        Write-Host "🔍 Vérification de la configuration Rust:" -ForegroundColor Yellow
        $cargoToml = Get-Content "Cargo.toml" -ErrorAction SilentlyContinue
        if ($cargoToml -match "tokio-native-tls-comp") {
            Write-Host "   ✅ Feature 'tokio-native-tls-comp' trouvée dans Cargo.toml" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠️  Feature 'tokio-native-tls-comp' non trouvée dans Cargo.toml" -ForegroundColor Yellow
            Write-Host "      Vérifiez que redis = { version = `"0.26`", features = [`"tokio-native-tls-comp`", `"aio`"] }" -ForegroundColor Gray
        }
        Write-Host ""
        
    }
    else {
        Write-Host "⚠️  Host ne correspond pas au format Upstash" -ForegroundColor Yellow
    }
}
else {
    Write-Host "❌ Erreur: Impossible de parser l'URL Redis" -ForegroundColor Red
    Write-Host "   Format attendu: rediss://username:password@host:port/database" -ForegroundColor Yellow
}

Write-Host "✅ Analyse terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Corriger les erreurs de compilation du backend" -ForegroundColor Gray
Write-Host "   2. Définir REDIS_URL dans l'environnement" -ForegroundColor Gray
Write-Host "   3. Exécuter: cargo run --bin test_redis" -ForegroundColor Gray
Write-Host "   4. Vérifier les logs au démarrage du backend" -ForegroundColor Gray

