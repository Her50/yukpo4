# ✅ Rapport : Vérification et implémentation timeout validation étapes

## 🔍 Problème identifié

L'utilisateur a demandé de vérifier la gestion des timeouts pour les validations d'étapes de livraison par les coursiers. Il a été constaté que :

1. ❌ Le système envoie des suggestions de proximité avec `auto_confirm_after_seconds: Some(30)`, mais **pas de mécanisme côté serveur** qui auto-confirme après 30 secondes
2. ❌ Pas de tâche périodique qui vérifie les timeouts
3. ❌ Pas de notifications d'alerte si le coursier ne confirme pas

## ✅ Solution implémentée

### 1. Tâche périodique `delivery_timeout_monitor`

**Fichier** : `backend/src/tasks/delivery_timeout_monitor.rs`

**Fonctionnalités** :
- ✅ Vérifie toutes les minutes les livraisons en attente de confirmation
- ✅ Auto-confirme les suggestions de proximité expirées (après 30 secondes)
- ✅ Envoie des notifications d'alerte si le coursier ne confirme pas après 2 minutes

**Fonctions** :
- `start_delivery_timeout_monitor()` : Démarre la tâche périodique
- `check_delivery_timeouts()` : Vérifie les timeouts
- `check_expired_proximity_suggestions()` : Auto-confirme les suggestions expirées
- `check_pending_confirmations()` : Envoie des notifications d'alerte

### 2. Table `delivery_proximity_suggestions` (À CRÉER)

**Structure** :
```sql
CREATE TABLE delivery_proximity_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id),
    suggested_status TEXT NOT NULL,
    location_type TEXT NOT NULL, -- "pickup" ou "dropoff"
    distance_meters FLOAT,
    auto_confirm_after_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'auto_confirmed', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    courier_user_id INTEGER REFERENCES users(id)
);
```

### 3. Modification `delivery_service.rs` (À FAIRE)

**À ajouter** : Stocker les suggestions dans la table lors de l'envoi de `ProximitySuggestion`.

### 4. Intégration dans `main.rs` (À FAIRE)

**À ajouter** :
```rust
// ✅ Monitor des timeouts de validation d'étapes
tasks::delivery_timeout_monitor::start_delivery_timeout_monitor(app_state.clone());
```

## 📋 Fichiers créés/modifiés

1. ✅ `backend/src/tasks/delivery_timeout_monitor.rs` (CRÉÉ)
2. ✅ `backend/src/tasks/mod.rs` (ajout module)
3. ⏳ `backend/src/migrations/auto_migrate.rs` (à ajouter : `ensure_delivery_proximity_suggestions_table`)
4. ⏳ `backend/src/services/delivery_service.rs` (à modifier : stocker suggestions)
5. ⏳ `backend/src/main.rs` (à modifier : démarrer tâche)

## ⚠️ Points importants

- **Délai auto-confirmation** : 30 secondes (configurable via `auto_confirm_after_seconds`)
- **Délai notification alerte** : 2 minutes (configurable)
- **Statuts surveillés** : `arrival_pickup`, `arrival_destination`, `picked_up`
- **Notifications envoyées à** : Coursier, Client, Prestataire

## 🚀 Prochaines étapes

1. Créer la table `delivery_proximity_suggestions` dans `auto_migrate.rs`
2. Modifier `delivery_service.rs` pour stocker les suggestions
3. Intégrer la tâche dans `main.rs`
4. Tester le système

