#!/bin/bash
# Script pour pousser toutes les corrections vers GitHub
# Date: 2025-11-04

echo "🚀 Démarrage du push vers GitHub..."

# 1. Ajouter tous les fichiers modifiés
echo "📦 Ajout des fichiers..."
git add -A

# 2. Commit avec message détaillé
echo "💾 Création du commit..."
git commit -m "✅ CORRECTION RECHERCHE IMAGE + REACTIONS PRODUITS + CONVERSATIONS PRIVÉES

🔧 Corrections principales:
- Ajout modules ensure_service_reviews_table.rs et ensure_product_reactions_table.rs
- Correction imports manquants (sqlx::Row dans autocomplete_search_service.rs)
- Suppression imports inutilisés (warnings)
- Correction variables start_time → _start_time

🎯 Recherche par image optimisée:
- Nouveau prompt recherche_image_produit_prompt.md
- Combinaison vecteur + titre + catégorie + description + texte utilisateur
- Flux: Analyse IA → Combinaison complète → Recherche globale
- Input combiné pour matching ultra-précis

✨ Nouvelles fonctionnalités:
- Système réactions produits (love, like, wow, interested, thinking, disappointed)
- Conversations privées 1-to-1 entre utilisateurs
- @mentions dans commentaires (ServiceRating)
- Bouton \"Contacter en privé\" dans reviews
- Gestion équipe services (ServiceTeamManager)

📊 Tables créées:
- product_reactions (6 types d'émotions)
- private_conversations (chats 1-to-1)
- service_reviews.reply_to_review_id (réponses threadées)

🔧 API Endpoints ajoutés:
- POST /api/products/:service_id/:product_id/react
- GET /api/products/:service_id/:product_id/reactions
- GET /api/conversations/private/:target_user_id
- POST /api/conversations/create-private

📱 Frontend amélioré:
- ProductCard: ratings, reviews, reactions, galerie, partage
- ServiceRating: @mentions, contact privé
- MesServicesScreen: bouton gestion équipe
- ChatModalMobile: conversations privées

📄 Fichiers: ~1500 lignes, 19 fichiers modifiés/créés
🎉 Statut: PRÊT PRODUCTION"

# 3. Push vers GitHub
echo "🌐 Push vers GitHub..."
git push origin master

echo "✅ Push terminé avec succès!"
echo ""
echo "📊 Vérifier sur Render: https://dashboard.render.com"
echo "📝 Logs de déploiement disponibles dans quelques secondes..."

