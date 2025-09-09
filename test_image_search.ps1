# Script PowerShell pour tester la création et recherche d'images dans Yukpo
# Ce script automatise le processus de test et vérifie l'état de la base de données

param(
    [string]$ImagePath = "test_image.jpg",
    [string]$BackendUrl = "http://localhost:3000",
    [string]$DatabaseUrl = "postgresql://username:password@localhost:5432/yukpo_db"
)

Write-Host "🚀 Test de création et recherche d'images dans Yukpo" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

# Vérifier que l'image de test existe
if (-not (Test-Path $ImagePath)) {
    Write-Host "❌ Image de test non trouvée: $ImagePath" -ForegroundColor Red
    Write-Host "💡 Veuillez placer l'image de test dans le répertoire courant" -ForegroundColor Yellow
    exit 1
}

Write-Host "📷 Image de test trouvée: $ImagePath" -ForegroundColor Green

# Vérifier que le backend est accessible
Write-Host "🔍 Vérification de l'accessibilité du backend..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health" -Method Get -TimeoutSec 10
    Write-Host "✅ Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Vérifiez que le backend est démarré sur $BackendUrl" -ForegroundColor Yellow
    exit 1
}

# Vérifier que la base de données est accessible
Write-Host "🗄️ Vérification de l'accessibilité de la base de données..." -ForegroundColor Cyan
try {
    # Utiliser psql si disponible
    $psqlOutput = & psql -h localhost -U postgres -d yukpo_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Base de données accessible via psql" -ForegroundColor Green
    } else {
        Write-Host "⚠️ psql non disponible ou erreur de connexion" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ psql non disponible" -ForegroundColor Yellow
}

# Vérifier la structure de la table media
Write-Host "🔍 Vérification de la structure de la table media..." -ForegroundColor Cyan
try {
    $mediaStructure = & psql -h localhost -U postgres -d yukpo_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' ORDER BY ordinal_position;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Structure de la table media:" -ForegroundColor Green
        $mediaStructure | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        
        # Vérifier les colonnes spécifiques à la recherche d'images
        $hasImageSignature = $mediaStructure -match "image_signature"
        $hasImageHash = $mediaStructure -match "image_hash"
        $hasImageMetadata = $mediaStructure -match "image_metadata"
        
        if ($hasImageSignature -and $hasImageHash -and $hasImageMetadata) {
            Write-Host "✅ Colonnes de recherche d'images présentes" -ForegroundColor Green
        } else {
            Write-Host "❌ Colonnes de recherche d'images manquantes" -ForegroundColor Red
            Write-Host "💡 Appliquez la migration: migrations/20250110000000_extend_media_for_image_search.sql" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Impossible de vérifier la structure de la table media" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier la structure de la table media" -ForegroundColor Yellow
}

# Vérifier les fonctions de recherche d'images
Write-Host "🔍 Vérification des fonctions de recherche d'images..." -ForegroundColor Cyan
try {
    $functions = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('search_similar_images', 'calculate_image_similarity');" 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($functions -match "search_similar_images") {
            Write-Host "✅ Fonction search_similar_images présente" -ForegroundColor Green
        } else {
            Write-Host "❌ Fonction search_similar_images manquante" -ForegroundColor Red
        }
        
        if ($functions -match "calculate_image_similarity") {
            Write-Host "✅ Fonction calculate_image_similarity présente" -ForegroundColor Green
        } else {
            Write-Host "❌ Fonction calculate_image_similarity manquante" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Impossible de vérifier les fonctions" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier les fonctions" -ForegroundColor Yellow
}

# Vérifier les index
Write-Host "🔍 Vérification des index de recherche d'images..." -ForegroundColor Cyan
try {
    $indexes = & psql -h localhost -U postgres -d yukpo_db -c "SELECT indexname FROM pg_indexes WHERE tablename = 'media' AND indexname LIKE '%image%';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($indexes) {
            Write-Host "✅ Index de recherche d'images présents:" -ForegroundColor Green
            $indexes | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        } else {
            Write-Host "❌ Aucun index de recherche d'images trouvé" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Impossible de vérifier les index" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier les index" -ForegroundColor Yellow
}

# Vérifier les médias existants
Write-Host "🔍 Vérification des médias existants..." -ForegroundColor Cyan
try {
    $mediaCount = & psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) as total, COUNT(CASE WHEN type = 'image' THEN 1 END) as images FROM media;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Statistiques des médias:" -ForegroundColor Green
        $mediaCount | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        
        # Vérifier les images avec signatures
        $imagesWithSignature = & psql -h localhost -U postgres -d yukpo_db -c "SELECT COUNT(*) FROM media WHERE type = 'image' AND image_signature IS NOT NULL;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Images avec signatures: $imagesWithSignature" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Impossible de vérifier les médias existants" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier les médias existants" -ForegroundColor Yellow
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "📋 Résumé de la vérification:" -ForegroundColor Yellow

# Résumé des vérifications
$checks = @(
    @{Name="Backend accessible"; Status=$true},
    @{Name="Structure table media"; Status=$hasImageSignature -and $hasImageHash -and $hasImageMetadata},
    @{Name="Fonctions de recherche"; Status=$functions -match "search_similar_images"},
    @{Name="Index de recherche"; Status=$indexes -ne $null}
)

foreach ($check in $checks) {
    $status = if ($check.Status) { "✅" } else { "❌" }
    $color = if ($check.Status) { "Green" } else { "Red" }
    Write-Host "$status $($check.Name)" -ForegroundColor $color
}

# Recommandations
Write-Host "`n🔧 Recommandations:" -ForegroundColor Yellow
if (-not ($hasImageSignature -and $hasImageHash -and $hasImageMetadata)) {
    Write-Host "1. Appliquez la migration: migrations/20250110000000_extend_media_for_image_search.sql" -ForegroundColor Red
}
if (-not ($functions -match "search_similar_images")) {
    Write-Host "2. Vérifiez que les fonctions SQL sont créées" -ForegroundColor Red
}
if (-not $indexes) {
    Write-Host "3. Vérifiez que les index sont créés" -ForegroundColor Red
}

Write-Host "`n4. Lancez le script Python: python test_image_search.py" -ForegroundColor Cyan
Write-Host "5. Vérifiez les logs du backend pour les erreurs" -ForegroundColor Cyan

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "🎯 Test de vérification terminé!" -ForegroundColor Green 