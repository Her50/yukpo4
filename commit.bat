@echo off
echo 🔧 Commit et push des corrections CORS...
git add .
git commit -m "fix: Correction CORS pour résoudre les erreurs de connexion frontend-backend"
git push origin master
echo ✅ Corrections CORS déployées avec succès
echo 🔄 Le backend va redémarrer automatiquement sur Render...
echo ⏱️  Attendez 2-3 minutes pour que les changements prennent effet
pause

