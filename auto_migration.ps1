# Script de migration automatique pour Render
 = "YOUR_PASSWORD"

Write-Host "Connexion à la base de données Render..."

# Commande 1: Ajouter colonne nom
Write-Host "Ajout de la colonne 'nom'..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(255);"

# Commande 2: Ajouter colonne prenom
Write-Host "Ajout de la colonne 'prenom'..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom VARCHAR(255);"

# Commande 3: Ajouter colonne nom_complet
Write-Host "Ajout de la colonne 'nom_complet'..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS nom_complet VARCHAR(255);"

# Commande 4: Ajouter colonne photo_profil
Write-Host "Ajout de la colonne 'photo_profil'..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_profil TEXT;"

# Commande 5: Ajouter colonne avatar_url
Write-Host "Ajout de la colonne 'avatar_url'..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;"

# Vérification
Write-Host "Vérification des colonnes ajoutées..."
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('nom', 'prenom', 'nom_complet', 'photo_profil', 'avatar_url');"

Write-Host "Migration terminée !"
