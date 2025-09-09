# Script PowerShell pour exporter le super admin
# export_superadmin.ps1

# Paramètres de connexion
$PGUSER = "postgres"
$PGDATABASE = "yukpo_db"
$PGHOST = "localhost"
$PGPORT = "5432"

# Demande le mot de passe
$PGPASSWORD = Read-Host -Prompt "Mot de passe PostgreSQL pour $PGUSER" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PGPASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Définit la variable d'environnement
$env:PGPASSWORD = $PlainPassword

Write-Host "Export du super admin..."

# Export en SQL
$sqlQuery = "SELECT * FROM users WHERE email = 'lelehernandez2007@yahoo.fr';"
$cmd = "psql -U $PGUSER -h $PGHOST -p $PGPORT -d $PGDATABASE -c `"$sqlQuery`""
$result = Invoke-Expression $cmd

Write-Host "Résultat de l'export :"
Write-Host $result

# Génère la commande INSERT
Write-Host "`nPour réinsérer après reset, utilise cette commande SQL :"
Write-Host "INSERT INTO users (id, email, password_hash, roles, created_at, updated_at) VALUES (...);"

# Nettoyage
Remove-Item Env:PGPASSWORD
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) 