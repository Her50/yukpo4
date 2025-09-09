# Script PowerShell pour réinitialiser complètement la table _sqlx_migrations
# À exécuter dans le dossier backend

# Paramètres de connexion
$env:PGUSER = "postgres"
$env:PGDATABASE = "yukpo_db"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

# Demander le mot de passe à l'utilisateur
$DatabasePassword = Read-Host -Prompt "Entrez le mot de passe pour l'utilisateur $env:PGUSER" -AsSecureString

# Convertir le mot de passe en texte clair pour la commande psql
$UnsecurePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword))

# Commande pour supprimer et recréer la table _sqlx_migrations
$env:PGPASSWORD = $UnsecurePassword

Write-Host "Suppression de la table _sqlx_migrations..."
psql -c "DROP TABLE IF EXISTS _sqlx_migrations CASCADE;"

Write-Host "Réinitialisation de l'historique des migrations..."
sqlx migrate run

Write-Host "Migrations appliquées avec succès !"

# Nettoyer la variable d'environnement pour des raisons de sécurité
Remove-Item Env:PGPASSWORD 