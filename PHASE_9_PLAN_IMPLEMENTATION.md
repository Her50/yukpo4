# 📋 Phase 9 : Fonctionnalités Avancées - Plan d'Implémentation

## 🎯 Améliorations de la Phase 9

### Amélioration 27 : Page publique dropoff ✅
**Statut** : DÉJÀ IMPLÉMENTÉ (Phase 4)
- Page publique pour clients sans compte
- Lien de partage pour fournir adresse de livraison

### Amélioration 28 : Sélection livreur personnel ⏳
**Objectif** : Permettre au prestataire de choisir son propre livreur pour une livraison

**Implémentation** :
1. Backend :
   - Ajouter champ `preferred_courier_id` dans `delivery_requests` ou `deliveries`
   - Modifier le matching pour prioriser le livreur choisi
   - Endpoint `POST /api/delivery/{id}/assign-courier` pour assigner manuellement

2. Frontend/Mobile :
   - Interface pour sélectionner un livreur dans la liste des coursiers disponibles
   - Afficher les coursiers disponibles avec leurs stats (taux de réussite, temps moyen)

### Amélioration 29 : Notification client fournit adresse ⏳
**Objectif** : Alerter le prestataire quand le client fournit son adresse de livraison

**Implémentation** :
1. Backend :
   - WebSocket event `DropoffAddressProvided` quand dropoff est confirmé
   - Notification push au prestataire
   - Optionnel : Email/SMS notification

2. Frontend/Mobile :
   - Badge/notification dans l'interface prestataire
   - Timeline de la livraison mise à jour

### Amélioration 30 : Amélioration UX dropoff pending ⏳
**Objectif** : Meilleure gestion du dropoff temporaire/optionnel

**Implémentation** :
1. Backend :
   - Statut `dropoff_pending` plus clair
   - Permettre modification dropoff même après matching
   - Recalculer distance si dropoff change

2. Frontend/Mobile :
   - Interface claire pour "Adresse à confirmer"
   - Bouton "Modifier l'adresse" visible et accessible
   - Indicateur visuel que l'adresse est temporaire

### Amélioration 31 : Chaînage vidéos lors création ⏳
**Objectif** : Définir des vidéos liées pendant la création de vidéo

**Implémentation** :
1. Backend :
   - Table `video_dependencies` ou champ dans `video_sessions`
   - Endpoint pour définir les dépendances
   - Navigation automatique vers vidéo suivante

2. Frontend/Mobile :
   - Sélecteur de vidéos liées dans le wizard de création
   - Affichage des vidéos liées dans la timeline

### Amélioration 32 : Plusieurs lieux de stock ⏳
**Objectif** : Prestataire peut avoir plusieurs points de départ, matching choisit le plus proche

**Implémentation** :
1. Backend :
   - Table `merchant_storage_locations` (plusieurs pickup par prestataire)
   - Modifier `product_delivery_config` pour référencer un storage_location_id
   - Modifier le matching pour calculer distance depuis tous les points de stock
   - Choisir le point le plus proche du dropoff

2. Frontend/Mobile :
   - Interface pour gérer plusieurs lieux de stock
   - Sélection du lieu de stock lors de la configuration produit
   - Affichage du lieu de stock choisi dans les détails de livraison

### Amélioration 33 : Renommage pickup/dropoff ⏳
**Objectif** : Remplacer par termes plus naturels : "départ" et "destination"

**Implémentation** :
1. Backend :
   - Optionnel : Alias dans les réponses API
   - Garder les noms techniques en base de données

2. Frontend/Mobile :
   - Remplacer tous les labels "pickup" par "Point de départ"
   - Remplacer tous les labels "dropoff" par "Destination"
   - Mettre à jour les messages utilisateur

## 📋 Ordre d'Implémentation Recommandé

1. **Amélioration 33** : Renommage (le plus simple, impact UX immédiat)
2. **Amélioration 30** : UX dropoff pending (améliore l'expérience existante)
3. **Amélioration 29** : Notification adresse (améliore la communication)
4. **Amélioration 28** : Sélection livreur (fonctionnalité importante)
5. **Amélioration 32** : Plusieurs lieux de stock (complexité moyenne)
6. **Amélioration 31** : Chaînage vidéos (fonctionnalité avancée)

## 🎯 Prochaine Étape

Commencer par l'**Amélioration 33** (Renommage) car c'est la plus simple et a un impact UX immédiat.

