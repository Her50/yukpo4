@echo off
setlocal
REM Modifiez les identifiants ci-dessous selon votre configuration PostgreSQL

set PGPASSWORD=Hernandez87
REM Ferme toutes les connexions actives à la base yukpo_db avant suppression
psql -U postgres -h localhost -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'yukpo_db' AND pid <> pg_backend_pid();"

REM Suppression et recréation de la base de test
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS yukpo_db;"
psql -U postgres -h localhost -c "CREATE DATABASE yukpo_db;"

REM Suppression forcée de la table _sqlx_migrations si elle existe (évite les doublons de clé)
psql -U postgres -h localhost -d yukpo_db -c "DROP TABLE IF EXISTS _sqlx_migrations;"

REM Nettoyage des doublons de fichiers de migration (même nom ou timestamp)
dir /b migrations > migrations_list.txt
REM Détection de doublons de nom de fichier
findstr /r /c:"^2025[0-9][0-9][0-9][0-9]_.*$" migrations_list.txt | sort | findstr /d /c:" " > tmp_count.txt
for /f %%f in (migrations_list.txt) do (
    findstr /c:"%%f" migrations_list.txt | find /c /v "" > tmp_count2.txt
    set /p count=<tmp_count2.txt
    if !count! gtr 1 echo Doublon de nom de fichier: %%f
)
REM Vérification automatique des doublons de contenu dans les fichiers de migration
setlocal enabledelayedexpansion
cd migrations
if exist ..\migration_hashes.txt del ..\migration_hashes.txt
for %%f in (*.sql) do (
    for /f "delims=" %%h in ('certutil -hashfile "%%f" SHA256 ^| find /i /v "certutil" ^| find /i /v "SHA256" ^| find /i /v "hash"') do (
        set hash=%%h
        echo !hash! %%f>> ..\migration_hashes.txt
    )
)
cd ..
REM Affiche les hashs pour vérification
findstr /r /c:"^[0-9A-F]* " migration_hashes.txt
REM Détection des doublons de hash (donc de contenu)
for /f "tokens=1* delims= " %%a in (migration_hashes.txt) do findstr /b /c:"%%a " migration_hashes.txt | find /c /v "" > tmp_count.txt && set /p count=<tmp_count.txt && if !count! gtr 1 echo Doublon de contenu: %%a
endlocal

REM Variables d'environnement pour sqlx et cargo (schéma public forcé)
set TEST_DATABASE_URL=postgres://postgres:Hernandez87@localhost/yukpo_db?search_path=public
set DATABASE_URL=postgres://postgres:Hernandez87@localhost/yukpo_db?search_path=public

REM Correction automatique : si une erreur de clé dupliquée survient lors de la migration, supprimer la table _sqlx_migrations et relancer la migration
:apply_migrations
sqlx migrate run
if errorlevel 1 (
    echo Erreur lors de l'application des migrations. Tentative de correction automatique...
    psql -U postgres -h localhost -d yukpo_db -c "DROP TABLE IF EXISTS _sqlx_migrations;"
    sqlx migrate run
    if errorlevel 1 (
        echo Echec critique : migrations impossibles même après correction. Abandon.
        exit /b 1
    )
)

REM Accorde les droits à l’utilisateur postgres sur toutes les tables et séquences
psql -U postgres -h localhost -d yukpo_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;"
psql -U postgres -h localhost -d yukpo_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;"

echo === Lancement des tests backend (séquentiel, log détaillé) ===
cargo test -- --nocapture --test-threads=1 --fail-fast

REM === Surveillance du dossier migrations AVANT toute opération ===
echo --- AVANT --- > migrations_avant.txt
echo %date% %time% >> migrations_avant.txt
dir /b migrations >> migrations_avant.txt
for %%f in (migrations\*.sql) do (
    echo --- CONTENU: %%f --- >> migrations_avant.txt
    type "%%f" >> migrations_avant.txt
)

REM === Surveillance du dossier migrations APRÈS toutes les opérations ===
echo --- APRES --- > migrations_apres.txt
echo %date% %time% >> migrations_apres.txt
dir /b migrations >> migrations_apres.txt
for %%f in (migrations\*.sql) do (
    echo --- CONTENU: %%f --- >> migrations_apres.txt
    type "%%f" >> migrations_apres.txt
)

REM Comparaison automatique des fichiers avant/après
fc migrations_avant.txt migrations_apres.txt > migrations_diff.txt
if %errorlevel%==0 (
    echo Aucun changement dans le dossier migrations.>> migrations_diff.txt
) else (
    echo Des fichiers ont été ajoutes ou modifies dans migrations.>> migrations_diff.txt
)
REM Affiche le résultat de la comparaison
more migrations_diff.txt
REM Affiche le journal détaillé
more migrations_journal.txt

pause
endlocal
