# Script simple pour appliquer les corrections maintenant
Write-Host "Application des corrections..." -ForegroundColor Yellow

# Demander le mot de passe
Write-Host "Mot de passe PostgreSQL:" -ForegroundColor Yellow
$password = Read-Host

# Definir la variable d'environnement
$env:PGPASSWORD = $password

# 1. CORRECTION GPS
Write-Host "Etape 1: Correction GPS..." -ForegroundColor Yellow

try {
    $gps_result = psql -h localhost -U postgres -d yukpo_db -f "final_gps_integration_fixed.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Correction GPS appliquee avec succes!" -ForegroundColor Green
        Write-Host "Resultats:" -ForegroundColor Cyan
        Write-Host $gps_result -ForegroundColor White
    } else {
        Write-Host "Erreur GPS:" -ForegroundColor Red
        Write-Host $gps_result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur GPS: $_" -ForegroundColor Red
}

# 2. CORRECTION DES IMAGES
Write-Host "Etape 2: Correction des images..." -ForegroundColor Yellow

try {
    $image_result = psql -h localhost -U postgres -d yukpo_db -f "fix_image_search_complete.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Correction des images appliquee avec succes!" -ForegroundColor Green
        Write-Host "Resultats:" -ForegroundColor Cyan
        Write-Host $image_result -ForegroundColor White
    } else {
        Write-Host "Erreur Images:" -ForegroundColor Red
        Write-Host $image_result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur Images: $_" -ForegroundColor Red
}

# Nettoyage
$env:PGPASSWORD = ""

Write-Host "Corrections terminees!" -ForegroundColor Green 