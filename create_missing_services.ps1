# Création des services manquants dans PostgreSQL
Write-Host "🛠️ Création des services manquants dans PostgreSQL" -ForegroundColor Cyan

# Services à créer basés sur les logs
$servicesToCreate = @(
    @{
        id = 27437
        titre = "Pressing Express"
        description = "Service de pressing rapide avec livraison sous 24h"
        category = "Services de nettoyage"
        prix = "3000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 228231
        titre = "Pressing Premium"
        description = "Service de pressing haut de gamme avec soins spéciaux"
        category = "Services de nettoyage"
        prix = "5000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 280093
        titre = "Pressing à Douala"
        description = "Service de pressing offrant nettoyage et repassage de vêtements à Douala"
        category = "Services de nettoyage"
        prix = "2500 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 697714
        titre = "Plomberie Express"
        description = "Service de plomberie pour réparations et installations"
        category = "Plomberie"
        prix = "15000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 681447
        titre = "Plomberie Pro"
        description = "Service de plomberie professionnel pour tous types de travaux"
        category = "Plomberie"
        prix = "20000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 531974
        titre = "Plomberie Rapide"
        description = "Service de plomberie avec intervention rapide"
        category = "Plomberie"
        prix = "12000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 235094
        titre = "Restaurant Le Gourmet"
        description = "Restaurant proposant une cuisine locale et internationale"
        category = "Restauration"
        prix = "5000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 773325
        titre = "Peinture Pro"
        description = "Service de peinture professionnel pour intérieur et extérieur"
        category = "Peinture et décoration"
        prix = "25000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 859203
        titre = "Décoration d'Intérieur"
        description = "Service de décoration d'intérieur personnalisé"
        category = "Décoration d'intérieur"
        prix = "35000 FCFA"
        gps = "Douala, Cameroun"
    },
    @{
        id = 559614
        titre = "Librairie Centrale"
        description = "Librairie offrant une large sélection de livres"
        category = "Commerce de détail"
        prix = "2000 FCFA"
        gps = "Douala, Cameroun"
    }
)

Write-Host "📋 Création de $($servicesToCreate.Count) services..." -ForegroundColor Yellow

foreach ($service in $servicesToCreate) {
    Write-Host "🛠️ Création du service ID: $($service.id) - $($service.titre)" -ForegroundColor Blue
    
    # Créer le JSONB data
    $dataJson = @{
        titre = @{
            type_donnee = "string"
            valeur = $service.titre
            origine_champs = "ia"
        }
        description = @{
            type_donnee = "string"
            valeur = $service.description
            origine_champs = "ia"
        }
        prix = @{
            type_donnee = "string"
            valeur = $service.prix
            origine_champs = "ia"
        }
    } | ConvertTo-Json -Depth 3
    
    # Requête SQL d'insertion
    $sqlInsert = @"
INSERT INTO services (id, user_id, data, category, gps, is_active, created_at, updated_at)
VALUES (
    $($service.id),
    1,
    '$dataJson',
    '$($service.category)',
    '$($service.gps)',
    true,
    NOW(),
    NOW()
);
"@
    
    try {
        # Exécuter la requête SQL (vous devrez ajuster les paramètres de connexion)
        $result = & psql -h localhost -U postgres -d yukpomnang -c $sqlInsert 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Service $($service.id) créé avec succès" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la création du service $($service.id)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lors de la création du service $($service.id): $_" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Création des services terminée !" -ForegroundColor Green
Write-Host "Vous pouvez maintenant relancer la recherche pour tester." -ForegroundColor Yellow 