# 🔒 Analyse de Sécurité : Prix Négociés

## ✅ Vérification de la Sécurité

### 1. Contrainte UNIQUE dans la base de données

La table `negotiated_prices` a une contrainte UNIQUE sur :
```sql
UNIQUE(conversation_id, service_id, product_index, client_user_id)
```

**✅ SÉCURISÉ** : Chaque combinaison `(conversation_id, service_id, product_index, client_user_id)` est unique. Cela signifie qu'un même client ne peut avoir qu'un seul prix négocié actif pour un produit donné dans une conversation donnée.

### 2. Requête SQL pour récupérer le prix négocié

Dans `negotiated_price_service.rs`, la fonction `get_active_negotiated_price` filtre par :
```rust
WHERE
    conversation_id = $1
    AND service_id = $2
    AND (product_index = $3 OR (product_index IS NULL AND $3 IS NULL))
    AND client_user_id = $4  // ✅ FILTRE PAR CLIENT
    AND status = 'accepted'
```

**✅ SÉCURISÉ** : La requête filtre explicitement par `client_user_id`, donc même si plusieurs clients partagent le même `conversation_id`, chacun récupère uniquement SON prix négocié.

### 3. Utilisation dans ProductPriceService

Dans `product_price_service.rs`, on passe bien `conversation_id` ET `client_user_id` :
```rust
negotiated_service.get_active_negotiated_price(
    conv_id,      // conversation_id
    service_id,
    product_index,
    client_id     // ✅ client_user_id
)
```

**✅ SÉCURISÉ** : Les deux paramètres sont passés, donc le filtrage par client est garanti.

## ⚠️ Point d'Attention : Utilisation de `service.id` comme `conversation_id`

### Problème potentiel

Dans `ChatModal.tsx` et `ChatModalMobile.tsx`, on utilise :
```typescript
conversationId={service.id}  // ⚠️ Utilise service.id au lieu de l'ID réel de la conversation
```

### Impact

Si plusieurs clients discutent avec le même prestataire pour le même service :
- Ils auront tous le même `conversation_id` (= `service.id`)
- MAIS ils auront des `client_user_id` différents
- Grâce à la contrainte UNIQUE et au filtrage par `client_user_id`, **il n'y a PAS de conflit**

### Conclusion

**✅ SÉCURISÉ** : Même si `conversation_id` n'est pas unique par client (car on utilise `service.id`), le système est sécurisé car :
1. La contrainte UNIQUE inclut `client_user_id`
2. La requête SQL filtre par `client_user_id`
3. Chaque client récupère uniquement SON prix négocié

### Recommandation (Optionnel)

Pour une meilleure sémantique, il serait préférable d'utiliser l'ID réel de la conversation (si le système de conversations le permet) :
```typescript
conversationId={conversation?.id || service.id}  // Utiliser l'ID réel de la conversation si disponible
```

Mais ce n'est **pas critique** pour la sécurité, car le filtrage par `client_user_id` garantit l'isolation des prix négociés.

## 🎯 Scénario de Test

### Scénario : Deux clients commandent le même produit simultanément

1. **Client A** (user_id=1) discute avec Prestataire pour Service X (service_id=10)
   - `conversation_id` = 10 (service.id)
   - Prix négocié : 15000 FCFA
   - Stocké avec : `(conversation_id=10, service_id=10, product_index=0, client_user_id=1)`

2. **Client B** (user_id=2) discute avec le même Prestataire pour Service X (service_id=10)
   - `conversation_id` = 10 (service.id) - **MÊME conversation_id**
   - Prix négocié : 12000 FCFA
   - Stocké avec : `(conversation_id=10, service_id=10, product_index=0, client_user_id=2)`

3. **Client A** clique sur "Se faire livrer"
   - Requête : `get_active_negotiated_price(10, 10, 0, 1)`
   - Résultat : **15000 FCFA** ✅ (prix du Client A)

4. **Client B** clique sur "Se faire livrer" (même moment)
   - Requête : `get_active_negotiated_price(10, 10, 0, 2)`
   - Résultat : **12000 FCFA** ✅ (prix du Client B)

**✅ AUCUN CONFLIT** : Chaque client récupère son propre prix négocié grâce au filtrage par `client_user_id`.

## ✅ Conclusion Finale

**Le système est SÉCURISÉ** :
- ✅ Contrainte UNIQUE inclut `client_user_id`
- ✅ Requête SQL filtre par `client_user_id`
- ✅ Pas de conflit entre clients différents
- ✅ Chaque client récupère uniquement SON prix négocié

**Recommandation** : Utiliser l'ID réel de la conversation si disponible pour une meilleure sémantique, mais ce n'est pas critique pour la sécurité.

