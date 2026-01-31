# Script pour trouver et ouvrir l'interface web du routeur
# Date: 2026-01-30

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Recherche de l'adresse IP du routeur..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Trouver la passerelle par défaut (adresse IP du routeur)
$gateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Where-Object {$_.NextHop -ne "0.0.0.0"} | Select-Object -First 1).NextHop

if ($gateway) {
    Write-Host "✅ Routeur trouvé !" -ForegroundColor Green
    Write-Host "   Adresse IP du routeur: $gateway" -ForegroundColor Yellow
    Write-Host ""
    
    # Tester la connexion au routeur
    Write-Host "Test de connexion au routeur..." -ForegroundColor Cyan
    $ping = Test-Connection -ComputerName $gateway -Count 2 -Quiet
    
    if ($ping) {
        Write-Host "✅ Routeur accessible (ping OK)" -ForegroundColor Green
        Write-Host ""
        
        # Essayer d'ouvrir l'interface web
        Write-Host "Ouverture de l'interface web du routeur..." -ForegroundColor Cyan
        Write-Host "   URL: http://$gateway" -ForegroundColor Yellow
        Write-Host ""
        
        try {
            Start-Process "http://$gateway"
            Write-Host "✅ Interface web ouverte dans votre navigateur" -ForegroundColor Green
            Write-Host ""
            Write-Host "Instructions:" -ForegroundColor Cyan
            Write-Host "1. Connectez-vous avec vos identifiants admin" -ForegroundColor Yellow
            Write-Host "2. Cherchez 'Redémarrer', 'Reboot' ou 'Restart' dans les paramètres" -ForegroundColor Yellow
            Write-Host "3. Cliquez sur 'Redémarrer' et attendez 2-3 minutes" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Impossible d'ouvrir automatiquement. Ouvrez manuellement:" -ForegroundColor Red
            Write-Host "   http://$gateway" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️ Routeur non accessible (ping échoué)" -ForegroundColor Yellow
        Write-Host "   Essayez quand même d'ouvrir: http://$gateway" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "URLs alternatives à essayer:" -ForegroundColor Cyan
    Write-Host "   http://$gateway" -ForegroundColor Yellow
    Write-Host "   https://$gateway" -ForegroundColor Yellow
    Write-Host "   http://192.168.1.1" -ForegroundColor Yellow
    Write-Host "   http://192.168.0.1" -ForegroundColor Yellow
    Write-Host "   http://10.0.0.1" -ForegroundColor Yellow
    
} else {
    Write-Host "❌ Impossible de trouver l'adresse IP du routeur" -ForegroundColor Red
    Write-Host ""
    Write-Host "URLs courantes à essayer manuellement:" -ForegroundColor Cyan
    Write-Host "   http://192.168.1.1" -ForegroundColor Yellow
    Write-Host "   http://192.168.0.1" -ForegroundColor Yellow
    Write-Host "   http://10.0.0.1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Note: Si l'interface web ne fonctionne pas," -ForegroundColor Yellow
Write-Host "      débranchez physiquement le routeur pendant 30 secondes" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

