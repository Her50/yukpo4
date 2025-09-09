# Script pour étendre la table media avec les colonnes d'image
# Assurez-vous que la base de données est accessible

Write-Host "Vérification de la structure actuelle de la table media..." -ForegroundColor Yellow

# Vérifier si les colonnes existent déjà
$checkColumns = @"
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN 'OUI' ELSE 'NON' END as has_image_signature,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN 'OUI' ELSE 'NON' END as has_image_hash,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN 'OUI' ELSE 'NON' END as has_image_metadata;
"@

Write-Host "Structure actuelle:" -ForegroundColor Cyan
Write-Host $checkColumns -ForegroundColor Gray

# SQL pour ajouter les colonnes si elles n'existent pas
$addColumns = @"
-- Ajouter les colonnes pour les signatures d'images si elles n'existent pas
DO `$`$
BEGIN
    -- Ajouter image_signature si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_signature'
    ) THEN
        ALTER TABLE media ADD COLUMN image_signature JSONB;
        RAISE NOTICE 'Colonne image_signature ajoutée';
    END IF;
    
    -- Ajouter image_hash si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_hash'
    ) THEN
        ALTER TABLE media ADD COLUMN image_hash VARCHAR(64);
        RAISE NOTICE 'Colonne image_hash ajoutée';
    END IF;
    
    -- Ajouter image_metadata si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'image_metadata'
    ) THEN
        ALTER TABLE media ADD COLUMN image_metadata JSONB;
        RAISE NOTICE 'Colonne image_metadata ajoutée';
    END IF;
END `$`$;
"@

Write-Host "`nAjout des colonnes manquantes..." -ForegroundColor Yellow
Write-Host $addColumns -ForegroundColor Gray

# Créer les index
$createIndexes = @"
-- Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_media_image_signature ON media USING GIN (image_signature);
CREATE INDEX IF NOT EXISTS idx_media_image_hash ON media(image_hash);
CREATE INDEX IF NOT EXISTS idx_media_image_metadata ON media USING GIN (image_metadata);
CREATE INDEX IF NOT EXISTS idx_media_type_image ON media(type) WHERE type = 'image';
"@

Write-Host "`nCréation des index..." -ForegroundColor Yellow
Write-Host $createIndexes -ForegroundColor Gray

Write-Host "`nScript SQL généré. Exécutez-le dans votre base de données." -ForegroundColor Green
Write-Host "Ou utilisez la migration: migrations/20250110000000_extend_media_for_image_search.sql" -ForegroundColor Cyan 