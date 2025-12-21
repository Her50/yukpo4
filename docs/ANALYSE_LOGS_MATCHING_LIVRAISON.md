# Analyse des Logs - Matching de Coursier après Création de Livraison

**Date**: 2025-12-21  
**Contexte**: L'utilisateur a créé une livraison et veut vérifier si le matching fonctionne

## 🔍 Analyse des Logs Fournis

### ✅ Indicateurs Positifs Trouvés

1. **Worker de Matching actif**:
   ```
   [DeliveryMatchingWorker] Cache actif: skip requête parallèle (dernier résultat vide il y a 29.916430494s)
   ```
   - Le worker s'exécute correctement
   - Il utilise le cache car il n'y a pas de nouvelles livraisons à traiter

2. **Requêtes SQL sur `delivery_matching_queue`**:
   ```sql
   SELECT id, delivery_id, zone_id, status, priority, attempt_count, payload, next_attempt_at, enqueued_at, updated_at
   FROM delivery_matching_queue
   WHERE status IN ('queued', 'searching')
     AND next_attempt_at <= NOW()
   ORDER BY priority ASC, next_attempt_at ASC
   LIMIT $1
   ```
   - Les requêtes sont exécutées régulièrement (toutes les 10 secondes)
   - **Problème**: Elles retournent **0 lignes** (`rows_returned":0`)

3. **Création de livraison réussie**:
   - `INSERT INTO delivery_parcels` ✅
   - `INSERT INTO deliveries` ✅
   - `INSERT INTO delivery_status_events` ✅

### ❌ Problème Identifié

**La livraison n'est PAS enregistrée dans `delivery_matching_queue` !**

Dans les logs, on voit :
- ✅ Création du colis (`delivery_parcels`)
- ✅ Création de la livraison (`deliveries`)
- ✅ Création d'un événement de statut (`delivery_status_events`)
- ❌ **AUCUN** `INSERT INTO delivery_matching_queue`

## 🔧 Cause Racine

D'après le code dans `backend/src/services/delivery_service.rs` (lignes 1379-1388) :

```rust
// ⚠️ MODIFICATION Phase 1 - Amélioration 2 :
// Ne plus déclencher le matching immédiatement à la création
// Le matching sera déclenché seulement après assign_delivery_recipient
// if let Err(err) = self.enqueue_delivery_matching(&summary).await {
//     ...
// }
```

Le matching n'est plus déclenché immédiatement à la création. Il est déclenché seulement après `assign_delivery_recipient` (lignes 1522-1530).

**Problème**: Si la livraison est créée avec un destinataire directement dans l'`INSERT INTO deliveries` (champs `recipient_user_id`, `recipient_contact_name`, etc.), alors `assign_delivery_recipient` n'est probablement **pas appelé**, et donc le matching n'est jamais déclenché.

## 📊 Vérification dans les Logs

Dans les logs, on voit que la livraison est créée avec :
- `recipient_user_id`
- `recipient_contact_name`
- `recipient_contact_phone`

Mais on ne voit **aucun** appel à `assign_delivery_recipient` ni à `enqueue_delivery_matching`.

## ✅ Solution

Il faut vérifier si `assign_delivery_recipient` est appelé après la création de la livraison, ou si le matching doit être déclenché directement lors de la création si un destinataire est déjà fourni.

### Option 1: Déclencher le matching si un destinataire est fourni à la création
Modifier `create_delivery_request` pour déclencher le matching si `recipient_user_id` ou `recipient_contact_phone` est fourni.

### Option 2: Toujours appeler `assign_delivery_recipient` après la création
Même si le destinataire est fourni dans la requête de création, appeler `assign_delivery_recipient` pour garantir que le matching est déclenché.

## 📝 Recommandation

**Option 2 est préférable** car elle garantit que le matching est toujours déclenché après l'assignation du destinataire, que ce soit à la création ou plus tard.

