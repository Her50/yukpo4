# Script PowerShell pour configurer l'accès à la base de données PostgreSQL

# Paramètres de connexion
$DatabaseName = "yukpo_test"
$DatabaseUser = "yukpo_user"
$DatabaseHost = "localhost"
$DatabasePort = 5432

# Demander le mot de passe à l'utilisateur
$DatabasePassword = Read-Host -Prompt "Entrez le mot de passe pour l'utilisateur $DatabaseUser" -AsSecureString

# Convertir le mot de passe en texte clair pour la commande psql
$UnsecurePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword))

# Tester la connexion à la base de données
Write-Host "Test de connexion à la base de données..."
$TestCommand = "psql -U $DatabaseUser -d $DatabaseName -h $DatabaseHost -p $DatabasePort -c 'SELECT 1;'"
$Env:PGPASSWORD = $UnsecurePassword

try {
    Invoke-Expression $TestCommand
    Write-Host "Connexion réussie à la base de données $DatabaseName avec l'utilisateur $DatabaseUser."
} catch {
    Write-Host "Échec de la connexion. Vérifiez les paramètres ou le mot de passe."
} finally {
    # Nettoyer la variable d'environnement pour des raisons de sécurité
    Remove-Item Env:PGPASSWORD
}