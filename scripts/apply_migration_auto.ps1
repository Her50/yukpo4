# Script pour appliquer automatiquement la migration delivery_proximity_suggestions
# Usage: .\scripts\apply_migration_auto.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$PublicIp = "34.79.199.41",
    [string]$Password = ""
)

Write-Host "🔄 Application automatique de la migration delivery_proximity_suggestions..." -ForegroundColor Cyan
Write-Host ""

# Vérifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: psql n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le fichier SQL existe
$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Erreur: Fichier de migration non trouvé: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   Instance: $InstanceName"
Write-Host "   Database: $DatabaseName"
Write-Host "   User: $User"
Write-Host "   IP: $PublicIp"
Write-Host ""

# Demander le mot de passe si non fourni
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host "🔐 Entrez le mot de passe pour $User (la saisie sera masquée):" -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    Write-Host ""
}

# Définir PGPASSWORD pour psql
$env:PGPASSWORD = $Password

Write-Host "🔌 Connexion à Cloud SQL..." -ForegroundColor Yellow
Write-Host "📝 Exécution de la migration..." -ForegroundColor Yellow
Write-Host ""

# Exécuter la migration
$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8

# Créer un fichier temporaire pour éviter les problèmes d'échappement
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sqlContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

try {
    # Exécuter via psql
    $output = & psql -h $PublicIp -U $User -d $DatabaseName -p 5432 -f $tempFile 2>&1
    
    # Afficher la sortie
    $output | ForEach-Object { Write-Host $_ }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        
        # Vérification
        Write-Host ""
        Write-Host "🔍 Vérification de la création de la table..." -ForegroundColor Cyan
        $checkQuery = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions') as table_exists;"
        $checkFile = [System.IO.Path]::GetTempFileName() + ".sql"
        $checkQuery | Out-File -FilePath $checkFile -Encoding UTF8 -NoNewline
        
        $checkOutput = & psql -h $PublicIp -U $User -d $DatabaseName -p 5432 -f $checkFile -t -A 2>&1
        
        if ($checkOutput -match "t|true|1") {
            Write-Host "✅ Table delivery_proximity_suggestions créée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Vérification: $checkOutput" -ForegroundColor Yellow
        }
        
        Remove-Item $checkFile -ErrorAction SilentlyContinue
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application de la migration (code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Vérifiez:" -ForegroundColor Yellow
        Write-Host "   - Que votre IP est autorisée dans Cloud SQL" -ForegroundColor Yellow
        Write-Host "   - Que le mot de passe est correct" -ForegroundColor Yellow
        Write-Host "   - Que l'instance Cloud SQL est accessible" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    $env:PGPASSWORD = $null
    Remove-Variable -Name Password -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Migration terminée!" -ForegroundColor Green

