# Vérification des services de coiffure en base PostgreSQL
Write-Host "Vérification des services de coiffure en base PostgreSQL..." -ForegroundColor Green

$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

$query = @"
SELECT id, 
       data->>'titre_service' as titre, 
       data->>'category' as category,
       data->>'description' as description
FROM services 
WHERE data->>'titre_service' ILIKE '%coiffure%' 
   OR data->>'category' ILIKE '%coiffure%'
   OR data->>'description' ILIKE '%coiffure%'
LIMIT 10;
"@

try {
    $result = psql $env:DATABASE_URL -c $query
    Write-Host "Résultats:" -ForegroundColor Yellow
    Write-Host $result -ForegroundColor White
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 