# Script simple pour appliquer la migration des champs media
Write-Host "Application de la migration des champs media..." -ForegroundColor Green

$DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

# Commande 1: Ajouter logo
Write-Host "Ajout de la colonne logo..." -ForegroundColor Yellow
psql $DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS logo VARCHAR(500);"

# Commande 2: Ajouter banniere
Write-Host "Ajout de la colonne banniere..." -ForegroundColor Yellow
psql $DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS banniere VARCHAR(500);"

# Commande 3: Ajouter images_realisations
Write-Host "Ajout de la colonne images_realisations..." -ForegroundColor Yellow
psql $DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS images_realisations TEXT[];"

# Commande 4: Ajouter videos
Write-Host "Ajout de la colonne videos..." -ForegroundColor Yellow
psql $DATABASE_URL -c "ALTER TABLE services ADD COLUMN IF NOT EXISTS videos TEXT[];"

# Commande 5: Ajouter service_media_type à media
Write-Host "Ajout de la colonne service_media_type..." -ForegroundColor Yellow
psql $DATABASE_URL -c "ALTER TABLE media ADD COLUMN IF NOT EXISTS service_media_type VARCHAR(50);"

Write-Host "Migration terminee !" -ForegroundColor Green
Write-Host "Verification de la structure..." -ForegroundColor Blue

# Vérifier la structure
psql $DATABASE_URL -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('logo', 'banniere', 'images_realisations', 'videos') ORDER BY column_name;" 