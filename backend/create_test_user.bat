@echo off
echo 📝 Creation d'un utilisateur de test pour Yukpo...
psql postgres://postgres:Hernandez87@localhost/yukpo_db -f create_test_user.sql
if %errorlevel% equ 0 (
    echo ✅ Utilisateur de test cree avec succes!
    echo.
    echo 📋 Informations de connexion:
    echo    Email: admin@yukpo.dev
    echo    Mot de passe: password123
    echo    Role: admin
    echo    Tokens: 10000
) else (
    echo ❌ Erreur lors de la creation de l'utilisateur
)
pause
