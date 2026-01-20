# Script pour vérifier l'état de l'application
param(
    [int]$Lines = 100
)

Write-Host "=== VERIFICATION DE L'ETAT DE L'APPLICATION ===" -ForegroundColor Cyan

# Récupérer les logs récents
Write-Host "`nRecuperation des logs recents..." -ForegroundColor Yellow
$logGroup = "/ecs/yukpomnang-backend"
$region = "eu-west-1"

# Utiliser aws logs tail qui gère mieux l'encodage
$logs = aws logs tail $logGroup --since 10m --region $region --format short 2>&1

# Filtrer les lignes importantes
Write-Host "`n=== POINTS DE VERIFICATION ===" -ForegroundColor Green

$checkpoints = @(
    "Base de donnees AWS RDS accessible",
    "Client MongoDB initialise",
    "Redis.*tentative 30",
    "Redis non accessible",
    "Serveur lance",
    "listening",
    "ERROR",
    "PANIC",
    "Connexion PostgreSQL etablie"
)

$found = @{}
foreach ($line in $logs) {
    foreach ($checkpoint in $checkpoints) {
        if ($line -match $checkpoint -and -not $found.ContainsKey($checkpoint)) {
            $found[$checkpoint] = $true
            Write-Host "[OK] $checkpoint" -ForegroundColor Green
        }
    }
}

# Vérifier les checkpoints manquants
Write-Host "`n=== CHECKPOINTS MANQUANTS ===" -ForegroundColor Yellow
foreach ($checkpoint in $checkpoints) {
    if (-not $found.ContainsKey($checkpoint)) {
        Write-Host "[MANQUANT] $checkpoint" -ForegroundColor Red
    }
}

# Afficher les dernières lignes
Write-Host "`n=== DERNIERES LIGNES DES LOGS ===" -ForegroundColor Cyan
$logs | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }




