@echo off
REM Script pour réinitialiser la table echanges et relancer toutes les migrations

REM Demande confirmation
set /p confirm="Cette opération va supprimer la table echanges et réappliquer toutes les migrations. Continuer ? (oui/non) : "
if /i not "%confirm%"=="oui" (
    echo Opération annulée.
    exit /b 1
)

REM Suppression de la table echanges (et données associées)
psql -h localhost -U postgres -d yukpo_db -c "DROP TABLE IF EXISTS echanges CASCADE;"

REM Application de toutes les migrations via le script PowerShell existant
powershell -ExecutionPolicy Bypass -File apply_migrations.ps1

echo Migrations terminées.
pause