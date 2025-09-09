# Synchronisation des services de coiffure entre Pinecone et PostgreSQL
Write-Host "Synchronisation des services de coiffure..." -ForegroundColor Green

$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

# Services de coiffure à ajouter (basés sur les IDs trouvés dans Pinecone)
$services = @(
    @{
        id = 599507
        titre = "Salon de coiffure moderne"
        category = "Coiffure"
        description = "Salon de coiffure offrant des coupes modernes et des services de coloration"
        user_id = 1
    },
    @{
        id = 134380
        titre = "Coiffure à domicile"
        category = "Beauté et soins personnels"
        description = "Un coiffeur professionnel se déplace chez vous pour réaliser la coupe ou le style de votre choix"
        user_id = 1
    },
    @{
        id = 577379
        titre = "Salon de coiffure à Ebolowa"
        category = "Coiffure"
        description = "Salon de coiffure 'Stylish Cuts' situé au centre-ville d'Ebolowa, réputé pour ses services de qualité"
        user_id = 1
    },
    @{
        id = 518870
        titre = "Salon de coiffure mixte à Ebolowa"
        category = "Services de coiffure"
        description = "Salon mixte situé à Ebolowa proposant des services de coiffure pour hommes et femmes, incluant coupes, colorations, et soins capillaires"
        user_id = 1
    }
)

foreach ($service in $services) {
    $data = @{
        titre_service = @{
            valeur = $service.titre
            type_donnee = "string"
            origine_champs = "synchronisation"
        }
        category = @{
            valeur = $service.category
            type_donnee = "string"
            origine_champs = "synchronisation"
        }
        description = @{
            valeur = $service.description
            type_donnee = "string"
            origine_champs = "synchronisation"
        }
        is_tarissable = @{
            valeur = $false
            type_donnee = "boolean"
            origine_champs = "synchronisation"
        }
        intention = "creation_service"
        actif = $true
    } | ConvertTo-Json -Depth 10

    $query = "INSERT INTO services (id, user_id, data, is_active, created_at) VALUES ($($service.id), $($service.user_id), '$data'::jsonb, true, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();"
    
    Write-Host "Ajout du service $($service.id): $($service.titre)" -ForegroundColor Yellow
    try {
        psql $env:DATABASE_URL -c $query
        Write-Host "✅ Service $($service.id) ajouté avec succès" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur pour le service $($service.id): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Synchronisation terminée!" -ForegroundColor Green 