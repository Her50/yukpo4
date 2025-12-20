# Script PowerShell pour tester la fonction GPS
# =============================================

$env:PGPASSWORD = "YOUR_PASSWORD"

$HOST = "your-render-db-host.render.com"
$USER = "yukpo_db_user"
$DB = "yukpo_db"

Write-Host "🔍 Vérification de la signature de search_services_gps_final..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Vérifier la signature
$query1 = @"
SELECT 
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;
"@

Write-Host "1. Signature de la fonction:" -ForegroundColor Yellow
echo $query1 | psql -h $HOST -U $USER -d $DB -t -A
Write-Host ""

# Test 2: Vérifier que DEFAULT NULL est présent
$query2 = @"
SELECT 
    CASE 
        WHEN pg_get_functiondef(oid) LIKE '%user_gps_zone text DEFAULT NULL%' 
        THEN '✅ Signature correcte avec DEFAULT NULL'
        ELSE '❌ Signature INCORRECTE'
    END as signature_status
FROM pg_proc
WHERE proname = 'search_services_gps_final'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY oid DESC
LIMIT 1;
"@

Write-Host "2. Vérification DEFAULT NULL:" -ForegroundColor Yellow
echo $query2 | psql -h $HOST -U $USER -d $DB -t -A
Write-Host ""

# Test 3: Tester avec NULL (sans GPS)
$query3 = @"
SELECT COUNT(*) as nombre_resultats
FROM search_services_gps_final('test', NULL, 50, 10);
"@

Write-Host "3. Test avec NULL (sans GPS):" -ForegroundColor Yellow
echo $query3 | psql -h $HOST -U $USER -d $DB -t -A
Write-Host ""

# Test 4: Tester avec zone GPS
$query4 = @"
SELECT COUNT(*) as nombre_resultats
FROM search_services_gps_final('vêtements', '4.0301206,9.818945', 50, 10);
"@

Write-Host "4. Test avec zone GPS:" -ForegroundColor Yellow
echo $query4 | psql -h $HOST -U $USER -d $DB -t -A
Write-Host ""

# Test 5: Vérifier les colonnes retournées (limite 2 pour éviter trop de données)
$query5 = @"
SELECT 
    service_id,
    titre_service,
    category,
    COALESCE(distance_km::text, 'NULL') as distance_km,
    relevance_score
FROM search_services_gps_final('vêtements', NULL, 50, 2);
"@

Write-Host "5. Exemple de résultats (2 premiers):" -ForegroundColor Yellow
echo $query5 | psql -h $HOST -U $USER -d $DB
Write-Host ""

Write-Host "✅ Tests terminés!" -ForegroundColor Green

# Nettoyer
Remove-Item Env:\PGPASSWORD

