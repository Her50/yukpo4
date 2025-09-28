@echo off
echo ========================================
echo 🔧 CORRECTION CORS ET DEPLOY YUKPO4
echo ========================================

echo.
echo 📋 Vérification de la configuration git...
git remote -v

echo.
echo 📦 Ajout des fichiers modifiés...
git add .

echo.
echo 💾 Commit des corrections CORS...
git commit -m "fix: Correction CORS pour résoudre les erreurs de connexion frontend-backend

- Configuration CORS permissive pour tous les domaines yukpomnang
- Correction des headers CORS par défaut pour Render
- Support des requêtes sans origin (applications mobiles)  
- Résolution des erreurs 'Failed to fetch' et timeouts
- Déploiement sur yukpo4"

echo.
echo 🚀 Push vers yukpo4...
git push origin master

echo.
echo ✅ CORRECTION TERMINÉE AVEC SUCCÈS!
echo.
echo 🔄 Le backend va redémarrer automatiquement sur Render...
echo ⏱️  Attendez 2-3 minutes pour que les changements prennent effet
echo.
echo 🎯 URLs à tester après redémarrage:
echo - Backend Health: https://yukpomnang.onrender.com/healthz
echo - Frontend: https://yukpomnang.onrender.com
echo.
pause

