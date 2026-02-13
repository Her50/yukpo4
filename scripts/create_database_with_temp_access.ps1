# Script pour creer la base de donnees avec acces temporaire
# Ce script guide l'utilisateur pour modifier le security group et creer la base

param(
    [string]$RdsEndpoint = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com",
    [string]$RdsUsername = "yukpo_admin",
    [string]$RdsPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd",
    [string]$DatabaseName = "yukpo",
    [string]$SecurityGroupName = "yukpo-rds-sg"
)

Write-Host "Creation de la base de donnees 'yukpo' avec acces temporaire" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Obtenir l'IP publique
Write-Host "Obtention de votre IP publique..." -ForegroundColor Yellow
try {
    $publicIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
    Write-Host "Votre IP publique: $publicIp" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Impossible d'obtenir votre IP publique" -ForegroundColor Red
    Write-Host "   Entrez votre IP manuellement ou utilisez 0.0.0.0/0 (moins securise)" -ForegroundColor Yellow
    $publicIp = Read-Host "Entrez votre IP publique"
}

Write-Host ""
Write-Host "ETAPE 1: Modifier le Security Group RDS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Allez dans AWS Console -> EC2 -> Security Groups" -ForegroundColor Yellow
Write-Host "2. Trouvez le Security Group: $SecurityGroupName" -ForegroundColor Yellow
Write-Host "3. Cliquez sur 'Modifier les regles entrantes' (Edit inbound rules)" -ForegroundColor Yellow
Write-Host "4. Ajoutez une regle:" -ForegroundColor Yellow
Write-Host "   - Type: PostgreSQL" -ForegroundColor Gray
Write-Host "   - Port: 5432" -ForegroundColor Gray
Write-Host "   - Source: $publicIp/32" -ForegroundColor Gray
Write-Host "   - Description: Acces temporaire pour creer la base" -ForegroundColor Gray
Write-Host "5. Sauvegardez" -ForegroundColor Yellow
Write-Host ""
$continue = Read-Host "Appuyez sur Entree une fois la regle ajoutee"

# Verifier que psql est disponible
Write-Host ""
Write-Host "Verification de psql..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERREUR: psql n'est pas installe" -ForegroundColor Red
    Write-Host "   Telechargez depuis: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "   Ou utilisez la methode EC2 (voir CREER_DATABASE_ACCES_TEMPORAIRE.md)" -ForegroundColor Yellow
    exit 1
}

# Construire l'URL de connexion
$adminDbUrl = "postgresql://${RdsUsername}:${RdsPassword}@${RdsEndpoint}:5432/postgres"

Write-Host ""
Write-Host "ETAPE 2: Verification de la connectivite..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$env:PGPASSWORD = $RdsPassword
$testResult = psql $adminDbUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de se connecter" -ForegroundColor Red
    Write-Host "   Verifiez que:" -ForegroundColor Yellow
    Write-Host "   1. La regle de securite a ete ajoutee correctement" -ForegroundColor Gray
    Write-Host "   2. Votre IP publique est correcte: $publicIp" -ForegroundColor Gray
    Write-Host "   3. L'instance RDS est accessible" -ForegroundColor Gray
    Write-Host "   Erreur: $testResult" -ForegroundColor Red
    exit 1
}
Write-Host "Connexion reussie!" -ForegroundColor Green

# Verifier si la base existe deja
Write-Host ""
Write-Host "ETAPE 3: Verification de l'existence de la base..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname='$DatabaseName'"
$dbExistsResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
$dbExists = ($dbExistsResult -match "^\s*1\s*$")

if ($dbExists) {
    Write-Host "La base '$DatabaseName' existe deja!" -ForegroundColor Green
    Write-Host "Aucune action necessaire" -ForegroundColor Gray
} else {
    # Creer la base de donnees
    Write-Host ""
    Write-Host "ETAPE 4: Creation de la base de donnees..." -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    $createQuery = "CREATE DATABASE `"$DatabaseName`";"
    $createResult = psql $adminDbUrl -v ON_ERROR_STOP=1 -c $createQuery 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Base '$DatabaseName' creee avec succes!" -ForegroundColor Green
        
        # Verifier
        Write-Host ""
        Write-Host "Verification finale..." -ForegroundColor Yellow
        $verifyResult = psql $adminDbUrl -tAc $dbExistsQuery 2>&1
        $verified = ($verifyResult -match "^\s*1\s*$")
        
        if ($verified) {
            Write-Host "Base '$DatabaseName' verifiee et prete a l'emploi!" -ForegroundColor Green
        }
    } else {
        Write-Host "ERREUR: Impossible de creer la base" -ForegroundColor Red
        Write-Host "   L'utilisateur '$RdsUsername' n'a peut-etre pas les permissions" -ForegroundColor Yellow
        Write-Host "   Erreur: $createResult" -ForegroundColor Red
        exit 1
    }
}

# Rappel de supprimer la regle
Write-Host ""
Write-Host "ETAPE 5: IMPORTANT - Supprimer la regle de securite temporaire" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host "1. Retournez dans le Security Group: $SecurityGroupName" -ForegroundColor Yellow
Write-Host "2. Supprimez la regle que vous avez ajoutee (IP: $publicIp/32)" -ForegroundColor Yellow
Write-Host "3. Sauvegardez" -ForegroundColor Yellow
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Verifiez que DATABASE_URL dans AWS Secrets Manager pointe vers la base '$DatabaseName'" -ForegroundColor Gray
Write-Host "   2. Redemarrez le backend ECS" -ForegroundColor Gray
Write-Host "   3. Les migrations s'appliqueront automatiquement" -ForegroundColor Gray

