Write-Host "🔧 Correction des services manquants dans PostgreSQL" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Configuration de la base de données
$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost:5432/yukpo_db"

# Services à insérer (basés sur les IDs trouvés dans les logs)
$servicesToInsert = @(
    @{
        id = 517896
        titre = "Recherche d'une librairie"
        description = "L'utilisateur cherche une librairie pour acheter ou consulter des livres."
        category = "Commerce de détail"
        is_active = $true
        user_id = 1
    },
    @{
        id = 559614
        titre = "Recherche d'une librairie"
        description = "L'utilisateur cherche une librairie pour acheter ou consulter des livres."
        category = "Commerce de détail"
        is_active = $true
        user_id = 1
    },
    @{
        id = 896775
        titre = "Librairie"
        description = "Librairie offrant une large gamme de livres, fournitures scolaires et articles de papeterie."
        category = "Commerce"
        is_active = $true
        user_id = 1
    },
    @{
        id = 757789
        titre = "Recherche de librairie pour fournitures scolaires"
        description = "Je cherche une librairie qui vend des fournitures scolaires."
        category = "Commerce de détail"
        is_active = $true
        user_id = 1
    },
    @{
        id = 235094
        titre = "Recherche d'un restaurant"
        description = "L'utilisateur cherche un restaurant."
        category = "Restauration"
        is_active = $true
        user_id = 1
    },
    @{
        id = 681447
        titre = "Recherche d'un plombier"
        description = "Je cherche un plombier pour des réparations ou installations de plomberie."
        category = "Plomberie"
        is_active = $true
        user_id = 1
    },
    @{
        id = 531974
        titre = "Recherche d'un plombier"
        description = "L'utilisateur cherche un plombier pour des travaux ou des réparations."
        category = "Plomberie"
        is_active = $true
        user_id = 1
    },
    @{
        id = 106740
        titre = "Vente de fournitures scolaires"
        description = "Service de vente de fournitures scolaires incluant stylos, cahiers, ardoises, gommes, règles, compas et crayons."
        category = "librairie"
        is_active = $true
        user_id = 1
    },
    @{
        id = 697714
        titre = "Recherche d'un plombier"
        description = "L'utilisateur cherche un plombier pour des travaux ou réparations."
        category = "Plomberie"
        is_active = $true
        user_id = 1
    },
    @{
        id = 773325
        titre = "Recherche d'un peintre professionnel"
        description = "Je cherche un peintre pour réaliser des travaux de peinture intérieure dans ma maison."
        category = "Peinture et décoration"
        is_active = $true
        user_id = 1
    }
)

Write-Host "`n📊 Services à insérer: $($servicesToInsert.Count)" -ForegroundColor Yellow

# Créer le script SQL
$sqlScript = @"
-- Script pour insérer les services manquants
BEGIN;

-- Vérifier si les services existent déjà
SELECT 'Vérification des services existants...' as info;

"@

foreach ($service in $servicesToInsert) {
    $sqlScript += @"

-- Service ID: $($service.id)
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    $($service.id),
    '$($service.titre)',
    '$($service.description)',
    '$($service.category)',
    $($service.is_active.ToString().ToLower()),
    $($service.user_id),
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insérer les données JSONB
INSERT INTO service_data (service_id, data_obj, created_at, updated_at)
VALUES (
    $($service.id),
    '{"titre": {"type_donnee": "string", "valeur": "$($service.titre)", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "$($service.description)", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "$($service.category)", "origine_champs": "ia"}}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (service_id) DO UPDATE SET
    data_obj = EXCLUDED.data_obj,
    updated_at = NOW();
"
}

$sqlScript += @"

COMMIT;

-- Vérifier les services insérés
SELECT 'Services insérés avec succès!' as info;
SELECT COUNT(*) as total_services FROM services WHERE is_active = true;
"@

# Écrire le script SQL
$sqlScript | Out-File -FilePath "insert_missing_services.sql" -Encoding UTF8

Write-Host "`n📝 Script SQL généré: insert_missing_services.sql" -ForegroundColor Green

# Exécuter le script SQL
Write-Host "`n🚀 Exécution du script SQL..." -ForegroundColor Yellow

try {
    # Utiliser psql pour exécuter le script
    $result = & psql -h localhost -U postgres -d yukpo_db -f "insert_missing_services.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Services insérés avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultat: $result" -ForegroundColor Gray
    } else {
        Write-Host "❌ Erreur lors de l'insertion: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Essayez d'exécuter manuellement: psql -h localhost -U postgres -d yukpo_db -f insert_missing_services.sql" -ForegroundColor Yellow
}

Write-Host "`n🎯 Test de la recherche après correction..." -ForegroundColor Cyan

# Test de recherche
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcl9pZCI6MSwiaWF0IjoxNzM1Mjg5NjAwLCJleHAiOjE3MzUzNzYwMDB9.test"
}

$payload = @{
    message = "je cherche une librairie"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "✅ Test de recherche réussi!" -ForegroundColor Green
    Write-Host "📊 Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Cyan
    Write-Host "📋 Résultats: $($response.resultats.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
} 