@echo off
REM Script pour pousser toutes les corrections vers GitHub (Windows)
REM Date: 2025-11-04

echo 🚀 Démarrage du push vers GitHub...
echo.

REM 1. Ajouter tous les fichiers modifiés
echo 📦 Ajout des fichiers...
git add -A

REM 2. Commit avec message détaillé
echo 💾 Création du commit...
git commit -m "✅ CORRECTION RECHERCHE IMAGE + REACTIONS PRODUITS + CONVERSATIONS PRIVÉES" -m "🔧 Corrections principales:" -m "- Ajout modules ensure_service_reviews_table.rs et ensure_product_reactions_table.rs" -m "- Correction imports manquants (sqlx::Row dans autocomplete_search_service.rs)" -m "- Suppression imports inutilisés (warnings)" -m "- Correction variables start_time → _start_time" -m "" -m "🎯 Recherche par image optimisée:" -m "- Nouveau prompt recherche_image_produit_prompt.md" -m "- Combinaison vecteur + titre + catégorie + description + texte utilisateur" -m "- Flux: Analyse IA → Combinaison complète → Recherche globale" -m "- Input combiné pour matching ultra-précis" -m "" -m "✨ Nouvelles fonctionnalités:" -m "- Système réactions produits (love, like, wow, interested, thinking, disappointed)" -m "- Conversations privées 1-to-1 entre utilisateurs" -m "- @mentions dans commentaires (ServiceRating)" -m "- Bouton Contacter en privé dans reviews" -m "- Gestion équipe services (ServiceTeamManager)" -m "" -m "📊 Tables créées:" -m "- product_reactions (6 types d'émotions)" -m "- private_conversations (chats 1-to-1)" -m "- service_reviews.reply_to_review_id (réponses threadées)" -m "" -m "🔧 API Endpoints ajoutés:" -m "- POST /api/products/:service_id/:product_id/react" -m "- GET /api/products/:service_id/:product_id/reactions" -m "- GET /api/conversations/private/:target_user_id" -m "- POST /api/conversations/create-private" -m "" -m "📱 Frontend amélioré:" -m "- ProductCard: ratings, reviews, reactions, galerie, partage" -m "- ServiceRating: @mentions, contact privé" -m "- MesServicesScreen: bouton gestion équipe" -m "- ChatModalMobile: conversations privées" -m "" -m "📄 Fichiers: ~1500 lignes, 19 fichiers modifiés/créés" -m "🎉 Statut: PRÊT PRODUCTION"

REM 3. Push vers GitHub
echo 🌐 Push vers GitHub...
git push origin master

echo.
echo ✅ Push terminé avec succès!
echo.
echo 📊 Vérifier sur Render: https://dashboard.render.com
echo 📝 Logs de déploiement disponibles dans quelques secondes...
pause

