# Script PowerShell pour forcer la réinitialisation de la base de données
# À exécuter dans le dossier backend

# Paramètres de connexion
$env:PGUSER = "postgres"
$env:PGDATABASE = "postgres"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

# Demander le mot de passe à l'utilisateur
$DatabasePassword = Read-Host -Prompt "Entrez le mot de passe pour l'utilisateur $env:PGUSER" -AsSecureString

# Convertir le mot de passe en texte clair pour la commande psql
$UnsecurePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword))

# Commande pour forcer la fermeture des connexions et recréer la base de données
$env:PGPASSWORD = $UnsecurePassword

Write-Host "Fermeture forcée de toutes les connexions à yukpo_db..."
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yukpo_db' AND pid <> pg_backend_pid();"

Write-Host "Suppression de la base de données yukpo_db..."
psql -c "DROP DATABASE IF EXISTS yukpo_db;"

Write-Host "Création de la nouvelle base de données yukpo_db..."
psql -c "CREATE DATABASE yukpo_db;"

Write-Host "Application des migrations..."
$env:PGDATABASE = "yukpo_db"
sqlx migrate run

Write-Host "Base de données réinitialisée avec succès !"

# Nettoyer la variable d'environnement pour des raisons de sécurité
Remove-Item Env:PGPASSWORD 