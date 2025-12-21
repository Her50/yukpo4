# Correction du Matching de Coursier - 2025-12-21

## 🔍 Problème Identifié

**Symptôme**: Après la création d'une livraison, le matching de coursier ne se déclenche pas.

**Analyse des logs**:
- ✅ La livraison est créée avec succès (`INSERT INTO deliveries`)
- ✅ Le worker de matching s'exécute correctement
- ✅ Les requêtes SQL sur `delivery_matching_queue` sont exécutées
- ❌ **AUCUN** `INSERT INTO delivery_matching_queue` dans les logs
- ❌ Les requêtes retournent 0 lignes (`rows_returned":0`)

## 🔧 Cause Racine

Dans `backend/src/services/delivery_service.rs`, le matching n'était plus déclenché immédiatement à la création de la livraison (lignes 1379-1388). Il était déclenché seulement après `assign_delivery_recipient`.

**Problème**: Si le destinataire est fourni directement dans la requête de création (champs `recipient_user_id`, `recipient_contact_name`, etc. dans l'`INSERT INTO deliveries`), alors `assign_delivery_recipient` n'est **pas appelé**, et donc le matching n'est jamais déclenché.

## ✅ Solution Appliquée

**Fichier modifié**: `backend/src/services/delivery_service.rs`

**Changement**: Déclencher le matching si un destinataire est fourni lors de la création de la livraison.

```rust
// ✅ CORRIGÉ 2025-12-21 : Déclencher le matching si un destinataire est fourni à la création
// Si le destinataire est fourni directement dans la requête de création, on doit déclencher le matching
// Sinon, le matching sera déclenché après assign_delivery_recipient
if summary.recipient.is_some() {
    if let Err(err) = self.enqueue_delivery_matching(&summary).await {
        log::error!(
            "[DeliveryMatching] Enfilement impossible pour la livraison {} (destinataire fourni à la création): {:?}",
            summary.id,
            err
        );
    } else {
        log::debug!(
            "[DeliveryMatching] ✅ Livraison {} enfilée dans la queue de matching (destinataire fourni à la création)",
            summary.id
        );
    }
}
```

## 📊 Comportement Après Correction

1. **Si le destinataire est fourni à la création**:
   - La livraison est créée
   - Le matching est déclenché immédiatement
   - La livraison est enfilée dans `delivery_matching_queue`
   - Le worker traite la livraison dans les 10 secondes suivantes

2. **Si le destinataire n'est pas fourni à la création**:
   - La livraison est créée
   - Le matching est déclenché après `assign_delivery_recipient`
   - La livraison est enfilée dans `delivery_matching_queue`
   - Le worker traite la livraison dans les 10 secondes suivantes

## 🧪 Vérification

Pour vérifier que la correction fonctionne :

1. **Créer une nouvelle livraison avec un destinataire**
2. **Vérifier les logs** pour :
   - `[DeliveryMatching] ✅ Livraison {id} enfilée dans la queue de matching`
   - `INSERT INTO delivery_matching_queue` dans les requêtes SQL
   - `[DeliveryMatchingWorker] X livraison(s) retraitées` dans les logs du worker

3. **Vérifier dans la base de données** :
   ```sql
   SELECT * FROM delivery_matching_queue 
   WHERE delivery_id = '{delivery_id}';
   ```

## 📝 Notes

- Le matching est maintenant déclenché dans tous les cas (avec ou sans destinataire à la création)
- Le worker de matching s'exécute toutes les 10 secondes
- Le cache du worker évite les requêtes inutiles si aucune livraison n'est en file

