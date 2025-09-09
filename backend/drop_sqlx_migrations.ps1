# Script PowerShell pour supprimer la table _sqlx_migrations
# À exécuter dans le dossier backend

# Paramètres de connexion (à adapter si besoin)
$env:PGUSER = "postgres"
$env:PGDATABASE = "yukpo_db"
$env:PGHOST = "localhost"
$env:PGPORT = "5432"

# Demander le mot de passe à l'utilisateur
$DatabasePassword = Read-Host -Prompt "Entrez le mot de passe pour l'utilisateur $env:PGUSER" -AsSecureString

# Convertir le mot de passe en texte clair pour la commande psql
$UnsecurePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword))

# Commande pour supprimer la table _sqlx_migrations
$env:PGPASSWORD = $UnsecurePassword
psql -c "DROP TABLE IF EXISTS _sqlx_migrations;"

Write-Host "Table _sqlx_migrations supprimée. Vous pouvez relancer 'sqlx migrate run'."

# Nettoyer la variable d'environnement pour des raisons de sécurité
Remove-Item Env:PGPASSWORD