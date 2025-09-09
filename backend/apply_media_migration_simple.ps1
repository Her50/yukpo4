# Script pour appliquer la migration des champs media aux services
# Date: 2025-08-30

Write-Host "Application de la migration des champs media aux services..." -ForegroundColor Green

# Configuration de la base de donnees
$DATABASE_URL = "postgres://postgres:Hernandez87@localhost/yukpo_db"

Write-Host "Connexion a la base de donnees..." -ForegroundColor Yellow

# Ajouter les colonnes media a la table services
Write-Host "Ajout des colonnes media..." -ForegroundColor Cyan

$commands = @(
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS logo VARCHAR(500)",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS banniere VARCHAR(500)",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS images_realisations TEXT[]",
    "ALTER TABLE services ADD COLUMN IF NOT EXISTS videos TEXT[]",
    "ALTER TABLE media ADD COLUMN IF NOT EXISTS service_media_type VARCHAR(50)"
)

$successCount = 0
$errorCount = 0

foreach ($command in $commands) {
    try {
        Write-Host "Execution: $command" -ForegroundColor White
        
        $result = psql $DATABASE_URL -c $command 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  SUCCES" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  ERREUR: $result" -ForegroundColor Red
            $errorCount++
        }
    }
    catch {
        Write-Host "  EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

# Resume
Write-Host "`nResume de la migration:" -ForegroundColor Magenta
Write-Host "  Commandes reussies: $successCount" -ForegroundColor Green
Write-Host "  Commandes echouees: $errorCount" -ForegroundColor Red

if ($errorCount -eq 0) {
    Write-Host "`nMigration appliquee avec succes !" -ForegroundColor Green
} else {
    Write-Host "`nMigration partiellement reussie avec $errorCount erreur(s)" -ForegroundColor Yellow
}

Write-Host "`nVerification de la structure..." -ForegroundColor Blue

# Verifier que les colonnes ont ete ajoutees
try {
    $checkResult = psql $DATABASE_URL -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('logo', 'banniere', 'images_realisations', 'videos') ORDER BY column_name;"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Structure de la table services verifiee:" -ForegroundColor Green
        Write-Host $checkResult -ForegroundColor White
    } else {
        Write-Host "Impossible de verifier la structure de la table" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Erreur lors de la verification: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nMigration terminee !" -ForegroundColor Green 