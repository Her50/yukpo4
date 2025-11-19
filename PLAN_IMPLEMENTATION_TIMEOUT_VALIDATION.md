# Plan d'implémentation : Timeout validation étapes livraison

## ✅ Problème identifié

Le système envoie des suggestions de proximité avec `auto_confirm_after_seconds: Some(30)`, mais :
- ❌ Pas de mécanisme côté serveur qui auto-confirme après 30 secondes
- ❌ Pas de tâche périodique qui vérifie les timeouts
- ❌ Pas de notifications d'alerte si le coursier ne confirme pas

## 🎯 Solution

### 1. Table `delivery_proximity_suggestions`

Stocke les suggestions de proximité avec timestamp et délai d'auto-confirmation.

### 2. Tâche périodique `delivery_timeout_monitor`

Vérifie toutes les minutes :
- Les suggestions expirées (auto-confirmation)
- Les livraisons en attente de confirmation depuis trop longtemps (notifications)

### 3. Modification `delivery_service.rs`

Stocker les suggestions dans la table lors de l'envoi de `ProximitySuggestion`.

### 4. Intégration dans `main.rs`

Démarrer la tâche périodique au démarrage du serveur.

## 📋 Fichiers à créer/modifier

1. ✅ `backend/src/tasks/delivery_timeout_monitor.rs` (CRÉÉ)
2. ⏳ `backend/src/migrations/auto_migrate.rs` (ajouter fonction `ensure_delivery_proximity_suggestions_table`)
3. ⏳ `backend/src/services/delivery_service.rs` (stocker suggestions)
4. ⏳ `backend/src/tasks/mod.rs` (ajouter module)
5. ⏳ `backend/src/main.rs` (démarrer tâche)

## ⚠️ Points importants

- Délai auto-confirmation : 30 secondes (configurable)
- Délai notification alerte : 2 minutes (configurable)
- Statuts surveillés : `arrival_pickup`, `arrival_destination`, `picked_up`

