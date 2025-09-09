# Script PowerShell pour appliquer la correction finale complète GPS
# ===============================================================

Write-Host "=== CORRECTION FINALE COMPLÈTE GPS ===" -ForegroundColor Green
Write-Host ""

# Lire la configuration de la base de données depuis .env
if (Test-Path ".env") {
    Write-Host "Lecture de la configuration depuis .env..." -ForegroundColor Yellow
    
    $envContent = Get-Content ".env"
    $dbHost = "localhost"
    $dbPort = "5432"
    $dbName = "yukpo_db"
    $dbUser = "postgres"
    
    foreach ($line in $envContent) {
        if ($line -match "^DATABASE_URL=postgres://(.+):(.+)@(.+)/(.+)") {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbName = $matches[4]
            
            # Extraire le port si présent
            if ($dbHost -match "(.+):(.+)") {
                $dbHost = $matches[1]
                $dbPort = $matches[2]
            }
        }
    }
    
    Write-Host "Configuration DB: $dbHost`:$dbPort/$dbName (user: $dbUser)" -ForegroundColor Cyan
} else {
    Write-Host "ERREUR: Fichier .env non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Application de la correction finale GPS..." -ForegroundColor Yellow

# Construire la commande psql
$psqlCommand = "psql -h $dbHost -p $dbPort -d $dbName -U $dbUser -f fix_gps_final_complete.sql"

Write-Host "Commande: $psqlCommand" -ForegroundColor Gray
Write-Host ""

try {
    # Exécuter le script SQL
    $result = Invoke-Expression $psqlCommand 2>&1
    
    Write-Host "=== RÉSULTAT EXÉCUTION ===" -ForegroundColor Green
    Write-Host $result
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ CORRECTION GPS APPLIQUÉE AVEC SUCCÈS !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Maintenant testons depuis le frontend :" -ForegroundColor Yellow
        Write-Host "1. Allez sur le frontend (déjà connecté)" -ForegroundColor White
        Write-Host "2. Faites une recherche avec 'restaurant'" -ForegroundColor White
        Write-Host "3. Vérifiez que vous obtenez maintenant des résultats filtrés par GPS" -ForegroundColor White
        Write-Host "4. Vérifiez que tous les résultats sont dans la zone de recherche" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ ERREUR lors de l'exécution du script" -ForegroundColor Red
        Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERREUR d'exécution: $($_.Exception.Message)" -ForegroundColor Red
} 