# Script pour appliquer la migration de promotion
# Date: 2025-08-30
# Configuration: Base yukpo_db, utilisateur postgres

Write-Host "🚀 Application de la migration de promotion..." -ForegroundColor Green

# Vérifier si psql est disponible
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL client détecté" -ForegroundColor Green
    } else {
        throw "psql non trouvé"
    }
} catch {
    Write-Host "❌ Erreur: PostgreSQL client (psql) non trouvé" -ForegroundColor Red
    Write-Host "Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Yellow
    exit 1
}

# Configuration de la base de données - ADAPTÉE À VOTRE ENVIRONNEMENT
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"  # Votre base de données
$DB_USER = "postgres"   # Votre utilisateur

Write-Host "📊 Configuration de la base:" -ForegroundColor Cyan
Write-Host "   Host: $DB_HOST" -ForegroundColor White
Write-Host "   Port: $DB_PORT" -ForegroundColor White
Write-Host "   Base: $DB_NAME" -ForegroundColor White
Write-Host "   User: $DB_USER" -ForegroundColor White

# Demander le mot de passe
Write-Host "🔐 Saisie du mot de passe..." -ForegroundColor Yellow
$DB_PASSWORD = Read-Host "Mot de passe pour l'utilisateur $DB_USER" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Chemin vers le fichier de migration
$MIGRATION_FILE = "backend/migrations/20250830_003_add_promotion_field.sql"

# Vérifier que le fichier existe
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Erreur: Fichier de migration non trouvé: $MIGRATION_FILE" -ForegroundColor Red
    Write-Host "Vérifiez que vous êtes dans le bon répertoire" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Fichier de migration: $MIGRATION_FILE" -ForegroundColor Cyan

# Tester la connexion à la base
Write-Host "🔌 Test de connexion à la base..." -ForegroundColor Yellow
try {
    $env:PGPASSWORD = $PlainPassword
    $testResult = psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion à la base réussie!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur de connexion à la base:" -ForegroundColor Red
        Write-Host $testResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors du test de connexion: $_" -ForegroundColor Red
    exit 1
}

# Appliquer la migration
try {
    Write-Host "🔄 Application de la migration..." -ForegroundColor Yellow
    
    $result = psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -f $MIGRATION_FILE 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "🎉 Le champ promotion a été ajouté à la table services" -ForegroundColor Green
        
        # Vérifier que la colonne a bien été ajoutée
        Write-Host "🔍 Vérification de la structure de la table..." -ForegroundColor Yellow
        $checkResult = psql -h $DB_HOST -p $DB_PORT -d $DB_NAME -U $DB_USER -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'promotion';" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Vérification réussie - Colonne promotion ajoutée" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Migration appliquée mais vérification échouée" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Erreur inattendue: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer le mot de passe de l'environnement
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "🎯 Migration terminée avec succès!" -ForegroundColor Green
Write-Host "💡 Vous pouvez maintenant utiliser les promotions dans vos services" -ForegroundColor Cyan
Write-Host "🚀 Redémarrez votre application pour prendre en compte les changements" -ForegroundColor Yellow 