# Script simple pour commit et push des corrections CORS
Write-Host "🔧 Commit et push des corrections CORS..." -ForegroundColor Cyan

# Ajouter tous les fichiers modifiés
git add .

# Commit avec message descriptif
git commit -m "fix: Correction CORS pour résoudre les erreurs de connexion frontend-backend

- Configuration CORS permissive pour tous les domaines yukpomnang
- Correction des headers CORS par défaut pour Render  
- Support des requêtes sans origin (applications mobiles)
- Résolution des erreurs 'Failed to fetch' et timeouts"

# Push vers le repository
git push origin master

Write-Host "✅ Corrections CORS déployées avec succès" -ForegroundColor Green
Write-Host "🔄 Le backend va redémarrer automatiquement sur Render..." -ForegroundColor Cyan
Write-Host "⏱️  Attendez 2-3 minutes pour que les changements prennent effet" -ForegroundColor Yellow

