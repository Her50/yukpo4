@echo off
REM Commande curl pour tester l'API assistance avec JWT
set /p TOKEN=<token_test.txt
curl -X POST http://127.0.0.1:3001/api/ia/auto -H "Authorization: Bearer %TOKEN%" -H "Content-Type: application/json" -d "{\"texte\":\"Comment fonctionne Yukpo ?\"}"
pause
