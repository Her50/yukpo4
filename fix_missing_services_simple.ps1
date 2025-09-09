Write-Host "🔧 Correction des services manquants dans PostgreSQL" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Services à insérer (basés sur les IDs trouvés dans les logs)
$servicesToInsert = @(
    @{id = 517896; titre = "Recherche d'une librairie"; description = "L'utilisateur cherche une librairie pour acheter ou consulter des livres."; category = "Commerce de détail"},
    @{id = 559614; titre = "Recherche d'une librairie"; description = "L'utilisateur cherche une librairie pour acheter ou consulter des livres."; category = "Commerce de détail"},
    @{id = 896775; titre = "Librairie"; description = "Librairie offrant une large gamme de livres, fournitures scolaires et articles de papeterie."; category = "Commerce"},
    @{id = 757789; titre = "Recherche de librairie pour fournitures scolaires"; description = "Je cherche une librairie qui vend des fournitures scolaires."; category = "Commerce de détail"},
    @{id = 235094; titre = "Recherche d'un restaurant"; description = "L'utilisateur cherche un restaurant."; category = "Restauration"},
    @{id = 681447; titre = "Recherche d'un plombier"; description = "Je cherche un plombier pour des réparations ou installations de plomberie."; category = "Plomberie"},
    @{id = 531974; titre = "Recherche d'un plombier"; description = "L'utilisateur cherche un plombier pour des travaux ou des réparations."; category = "Plomberie"},
    @{id = 106740; titre = "Vente de fournitures scolaires"; description = "Service de vente de fournitures scolaires incluant stylos, cahiers, ardoises, gommes, règles, compas et crayons."; category = "librairie"},
    @{id = 697714; titre = "Recherche d'un plombier"; description = "L'utilisateur cherche un plombier pour des travaux ou réparations."; category = "Plomberie"},
    @{id = 773325; titre = "Recherche d'un peintre professionnel"; description = "Je cherche un peintre pour réaliser des travaux de peinture intérieure dans ma maison."; category = "Peinture et décoration"}
)

Write-Host "`n📊 Services à insérer: $($servicesToInsert.Count)" -ForegroundColor Yellow

# Créer le script SQL
$sqlScript = "BEGIN;`n"

foreach ($service in $servicesToInsert) {
    $titre = $service.titre -replace "'", "''"
    $description = $service.description -replace "'", "''"
    $category = $service.category -replace "'", "''"
    
    $sqlScript += @"
-- Service ID: $($service.id)
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    $($service.id),
    '$titre',
    '$description',
    '$category',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

"@
}

$sqlScript += "COMMIT;`n"

# Écrire le script SQL
$sqlScript | Out-File -FilePath "insert_missing_services.sql" -Encoding UTF8

Write-Host "`n📝 Script SQL généré: insert_missing_services.sql" -ForegroundColor Green

# Afficher le contenu du script
Write-Host "`n📋 Contenu du script SQL:" -ForegroundColor Yellow
Get-Content "insert_missing_services.sql" | Write-Host

Write-Host "`n💡 Pour exécuter le script, utilisez:" -ForegroundColor Cyan
Write-Host "psql -h localhost -U postgres -d yukpo_db -f insert_missing_services.sql" -ForegroundColor White

Write-Host "`n🎯 Après avoir exécuté le script, testez la recherche:" -ForegroundColor Cyan
Write-Host "La recherche devrait maintenant retourner des résultats!" -ForegroundColor Green 