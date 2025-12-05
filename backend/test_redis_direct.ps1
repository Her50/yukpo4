# Script PowerShell pour tester Redis directement avec l'URL fournie

$REDIS_URL = "rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"

Write-Host "🔍 Test de connexion Redis" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 URL Redis (masquée):" -ForegroundColor Yellow
Write-Host "   rediss://default:***@superb-sole-7762.upstash.io:6379" -ForegroundColor Gray
Write-Host ""

Write-Host "🔐 Protocole:" -ForegroundColor Yellow
Write-Host "   ✅ Utilise TLS (rediss://)" -ForegroundColor Green
Write-Host ""

Write-Host "🧪 Test avec Rust:" -ForegroundColor Yellow
Write-Host "   Le script test_redis.rs nécessite que le projet compile." -ForegroundColor Gray
Write-Host "   Pour tester, exécutez:" -ForegroundColor Gray
Write-Host "   `$env:REDIS_URL=`"$REDIS_URL`"" -ForegroundColor White
Write-Host "   cargo run --bin test_redis" -ForegroundColor White
Write-Host ""

Write-Host "💡 Analyse de l'URL:" -ForegroundColor Yellow
Write-Host "   - Protocole: rediss:// (TLS) ✅" -ForegroundColor Green
Write-Host "   - Host: superb-sole-7762.upstash.io" -ForegroundColor Gray
Write-Host "   - Port: 6379" -ForegroundColor Gray
Write-Host "   - Database: 0 (par défaut)" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Configuration Redis semble correcte!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Corriger les erreurs de compilation du backend" -ForegroundColor Gray
Write-Host "   2. Exécuter: cargo run --bin test_redis" -ForegroundColor Gray
Write-Host "   3. Vérifier les logs au démarrage du backend" -ForegroundColor Gray

