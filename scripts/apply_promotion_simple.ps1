# Script simple pour appliquer la migration de promotion
# Date: 2025-08-30

Write-Host "🚀 Application de la migration de promotion..." -ForegroundColor Green

# Configuration de la base de données
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"
$SQL_FILE = "scripts/apply_promotion_simple.sql"

Write-Host "📊 Configuration:" -ForegroundColor Cyan
Write-Host "   Base: $DB_NAME" -ForegroundColor White
Write-Host "   User: $DB_USER" -ForegroundColor White
Write-Host "   Fichier: $SQL_FILE" -ForegroundColor White

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SQL_FILE)) {
    Write-Host "❌ Fichier SQL non trouvé: $SQL_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "🔐 Saisie du mot de passe PostgreSQL..." -ForegroundColor Yellow
$DB_PASSWORD = Read-Host "Mot de passe pour l'utilisateur $DB_USER" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Appliquer la migration
try {
    Write-Host "🔄 Application de la migration..." -ForegroundColor Yellow
    
    $env:PGPASSWORD = $PlainPassword
    
    $result = psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f $SQL_FILE 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "🎉 Le champ promotion a été ajouté à la table services" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Erreur inattendue: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "🎯 Migration terminée!" -ForegroundColor Green
Write-Host "💡 Redémarrez votre application pour prendre en compte les changements" -ForegroundColor Yellow 