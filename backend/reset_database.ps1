# Script PowerShell : reset_database.ps1
# Sauvegarde ce script et double-clique dessus

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

Write-Host "Suppression de toutes les tables..."

# Script SQL pour supprimer toutes les tables
$sqlScript = @"
-- Version NUCLEAIRE - Supprime TOUT
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
"@

# Exécute le script SQL
$cmd = "psql -U $PGUSER -h $PGHOST -p $PGPORT -d $PGDATABASE -c `"$sqlScript`""
$result = Invoke-Expression $cmd

Write-Host "Résultat :"
Write-Host $result

Write-Host "`nVérification des tables restantes..."

# Vérifie qu'il n'y a plus de tables
$checkCmd = "psql -U $PGUSER -h $PGHOST -p $PGPORT -d $PGDATABASE -c `"SELECT tablename FROM pg_tables WHERE schemaname = 'public';`""
$checkResult = Invoke-Expression $checkCmd

Write-Host "Tables restantes :"
Write-Host $checkResult

if ($checkResult -match "0 rows") {
    Write-Host "`n✅ SUCCÈS : Toutes les tables ont été supprimées !"
    Write-Host "Tu peux maintenant relancer : sqlx migrate run"
} else {
    Write-Host "`n❌ ÉCHEC : Il reste encore des tables"
}

# Nettoyage
Remove-Item Env:PGPASSWORD
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host "`nAppuie sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")