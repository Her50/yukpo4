# Script PowerShell de vérification rapide de la base de données
# Usage: .\check_db.ps1

Write-Host "🔍 DIAGNOSTIC RAPIDE - BASE DE DONNÉES" -ForegroundColor Cyan
Write-Host ""

# Charger DATABASE_URL depuis .env
$envPath = ".env"
if (Test-Path $envPath) {
    $dbUrl = (Get-Content $envPath | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=", ""
    
    if ($dbUrl) {
        Write-Host "✅ Connexion à la base..." -ForegroundColor Green
        Write-Host ""
        
        # Requête 1: Vérifier table
        Write-Host "1️⃣ Table autocomplete_combinations :" -ForegroundColor Yellow
        $env:DATABASE_URL = $dbUrl
        psql $dbUrl -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations') as table_exists;"
        
        Write-Host ""
        Write-Host "2️⃣ Colonnes critiques :" -ForegroundColor Yellow
        psql $dbUrl -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name IN ('product_vector', 'product_labels', 'location_labels', 'usage_count') ORDER BY column_name;"
        
        Write-Host ""
        Write-Host "3️⃣ Nombre d'enregistrements :" -ForegroundColor Yellow
        psql $dbUrl -c "SELECT COUNT(*) as total, COUNT(CASE WHEN usage_count >= 2 THEN 1 END) as populaires FROM autocomplete_combinations;"
        
        Write-Host ""
        Write-Host "4️⃣ TOP 3 produits :" -ForegroundColor Yellow
        psql $dbUrl -c "SELECT product_vector, usage_count FROM autocomplete_combinations ORDER BY usage_count DESC LIMIT 3;"
        
        Write-Host ""
        Write-Host "✅ Diagnostic terminé" -ForegroundColor Cyan
    } else {
        Write-Host "❌ DATABASE_URL introuvable dans .env" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier .env introuvable" -ForegroundColor Red
}

