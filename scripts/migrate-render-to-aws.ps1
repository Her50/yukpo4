# 📦 Script de Migration des Données depuis Render vers AWS RDS

param(
    [Parameter(Mandatory = $true)]
    [string]$RenderDbUrl,
    
    [Parameter(Mandatory = $true)]
    [string]$AwsRdsUrl,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipExtensions = $false
)

$ErrorActionPreference = "Stop"

function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

# Vérifier pg_dump et pg_restore
try {
    pg_dump --version | Out-Null
    pg_restore --version | Out-Null
} catch {
    Write-Error "❌ PostgreSQL client tools non trouvés. Installez PostgreSQL client."
    exit 1
}

# Export depuis Render
Write-Info "📥 Export des données depuis Render..."
$backupFile = "backup_render_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

try {
    # Extraire le mot de passe de l'URL
    if ($RenderDbUrl -match '://([^:]+):([^@]+)@') {
        $username = $matches[1]
        $password = $matches[2]
        $env:PGPASSWORD = $password
    }
    
    # Export en format custom (compressé)
    pg_dump -F c -f $backupFile $RenderDbUrl
    
    if ($LASTEXITCODE -ne 0) {
        throw "Échec de l'export"
    }
    
    Write-Success "✅ Données exportées vers $backupFile"
} catch {
    Write-Error "❌ Erreur lors de l'export: $_"
    exit 1
}

# Import vers RDS
Write-Info "📤 Import des données vers AWS RDS..."

try {
    # Extraire le mot de passe de l'URL
    if ($AwsRdsUrl -match '://([^:]+):([^@]+)@') {
        $username = $matches[1]
        $password = $matches[2]
        $env:PGPASSWORD = $password
    }
    
    # Import avec options pour éviter les erreurs de permissions
    pg_restore -d $AwsRdsUrl -F c $backupFile --no-owner --no-acl --verbose
    
    if ($LASTEXITCODE -ne 0) {
        throw "Échec de l'import"
    }
    
    Write-Success "✅ Données importées vers RDS"
} catch {
    Write-Error "❌ Erreur lors de l'import: $_"
    exit 1
}

# Installer les extensions PostgreSQL
if (-not $SkipExtensions) {
    Write-Info "🔧 Installation des extensions PostgreSQL (pgvector, imgsmlr)..."
    
    try {
        # Se connecter et installer les extensions
        $extensions = @("vector", "imgsmlr")
        
        foreach ($ext in $extensions) {
            Write-Info "   Installation de l'extension: $ext"
            psql $AwsRdsUrl -c "CREATE EXTENSION IF NOT EXISTS $ext;"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "   ✅ Extension $ext installée"
            } else {
                Write-Warning "   ⚠️  Échec de l'installation de $ext (peut-être déjà installée)"
            }
        }
    } catch {
        Write-Warning "⚠️  Erreur lors de l'installation des extensions: $_"
        Write-Warning "   Vous pouvez les installer manuellement plus tard"
    }
}

Write-Success "🎉 Migration terminée avec succès !"
Write-Info "📁 Backup sauvegardé dans: $backupFile"
Write-Warning "⚠️  N'oubliez pas de supprimer le fichier de backup après vérification"






