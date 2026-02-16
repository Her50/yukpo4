# Script pour vérifier et lister les bases de données dans Cloud SQL
# Usage: .\scripts\verifier-bases-donnees-gcp.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseUrl = ""
)

Write-Host "Verification Bases de Donnees Cloud SQL" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouvé" -ForegroundColor Red
    Write-Host "   Installez Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Instance: $InstanceName"
Write-Host ""

# Etape 1: Lister les bases de donnees
Write-Host "[ETAPE 1/3] Liste des bases de donnees dans l'instance..." -ForegroundColor Yellow
Write-Host ""

$databases = gcloud sql databases list --instance=$InstanceName --project=$ProjectId --format="json" 2>&1

if ($LASTEXITCODE -eq 0) {
    $dbList = $databases | ConvertFrom-Json
    
    if ($dbList.Count -eq 0) {
        Write-Host "   ⚠️  Aucune base de données trouvée" -ForegroundColor Yellow
    } else {
        Write-Host "   Bases de données trouvées:" -ForegroundColor Green
        Write-Host ""
        
        $foundYukpoPostgres = $false
        $foundYukpoDb = $false
        
        foreach ($db in $dbList) {
            $name = $db.name
            $charset = $db.charset
            $collation = $db.collation
            
            Write-Host "   📊 $name" -ForegroundColor White
            Write-Host "      Charset: $charset" -ForegroundColor Gray
            Write-Host "      Collation: $collation" -ForegroundColor Gray
            
            if ($name -eq "yukpo_postgres") {
                Write-Host "      [OK] BASE PRINCIPALE (a utiliser)" -ForegroundColor Green
                $foundYukpoPostgres = $true
            } elseif ($name -eq "yukpo_db") {
                Write-Host "      [WARN] BASE ANCIENNE (a verifier)" -ForegroundColor Yellow
                $foundYukpoDb = $true
            }
            
            Write-Host ""
        }
        
        # Résumé
        Write-Host "   Résumé:" -ForegroundColor Cyan
        if ($foundYukpoPostgres) {
            Write-Host "      ✅ yukpo_postgres: TROUVÉE (base principale)" -ForegroundColor Green
        } else {
            Write-Host "      ❌ yukpo_postgres: NON TROUVÉE" -ForegroundColor Red
        }
        
        if ($foundYukpoDb) {
            Write-Host "      ⚠️  yukpo_db: TROUVÉE (base ancienne)" -ForegroundColor Yellow
        } else {
            Write-Host "      ℹ️  yukpo_db: NON TROUVÉE (peut être obsolète)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ❌ Erreur lors de la récupération des bases de données" -ForegroundColor Red
    Write-Host "   Message: $databases" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 2: Verifier la DATABASE_URL si fournie
if ($DatabaseUrl) {
    Write-Host "[ETAPE 2/3] Analyse de la DATABASE_URL..." -ForegroundColor Yellow
    Write-Host ""
    
    # Extraire le nom de la base depuis l'URL
    if ($DatabaseUrl -match "/([^/?]+)(\?|$)") {
        $dbName = $matches[1]
        Write-Host "   Base de données dans DATABASE_URL: $dbName" -ForegroundColor White
        
        if ($dbName -eq "yukpo_postgres") {
            Write-Host "   ✅ CORRECT: Utilise la base principale" -ForegroundColor Green
        } elseif ($dbName -eq "yukpo_db") {
            Write-Host "   [WARN] ATTENTION: Utilise la base ancienne" -ForegroundColor Yellow
            Write-Host "      Recommendation: Changer vers yukpo_postgres" -ForegroundColor Yellow
        } else {
            Write-Host "   ⚠️  Base inconnue: $dbName" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Impossible d'extraire le nom de la base depuis DATABASE_URL" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Etape 3: Recommendations
Write-Host "[ETAPE 3/3] Recommendations..." -ForegroundColor Yellow
Write-Host ""

Write-Host "   📋 Actions recommandées:" -ForegroundColor Cyan
Write-Host "   1. Utiliser uniquement 'yukpo_postgres' comme base principale" -ForegroundColor White
Write-Host "   2. Vérifier que DATABASE_URL pointe vers 'yukpo_postgres'" -ForegroundColor White
Write-Host "   3. Mettre à jour la documentation si nécessaire" -ForegroundColor White
Write-Host "   4. Si 'yukpo_db' est obsolète, la renommer ou la supprimer" -ForegroundColor White

Write-Host ""
Write-Host "   📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Voir: CLARIFICATION_BASES_DONNEES_GCP.md" -ForegroundColor White

Write-Host ""
Write-Host "[OK] Verification terminee" -ForegroundColor Green

