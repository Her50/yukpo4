# Analyse de la lenteur de la page "Mes Services"

## Date: 2025-11-26

## Problèmes identifiés dans les logs

### 1. ❌ PROBLÈME CRITIQUE : Taille de réponse énorme

**Symptôme observé :**
```
responseBytes=6500627  (≈ 6.5 MB)
responseBytes=6500350  (≈ 6.5 MB)
```

**Pour seulement 1 service !** C'est anormalement volumineux.

**Cause probable :**
Le champ `data` JSONB contient probablement :
- Des produits avec beaucoup de données (images base64, descriptions longues, etc.)
- Des médias (images, vidéos) encodés en base64 ou avec URLs complètes
- Des données Google Places enrichies (photos, horaires, etc.)
- Des données volumineuses non nécessaires pour la liste

---

### 2. ⚠️ PROBLÈME MAJEUR : Temps de réponse élevé

**Symptôme observé :**
```
responseTimeMS=662
responseTimeMS=965
responseTimeMS=771
responseTimeMS=1003
responseTimeMS=721
```

**Temps moyen : ~800ms** pour récupérer 1 service, ce qui est trop lent.

**Causes identifiées :**

#### a) Requêtes SQL multiples inutiles
Le code fait **4 requêtes SQL** pour chaque appel :
1. ✅ Vérification `is_provider` (nécessaire)
2. ❌ Requête debug (derniers 5 services) - **INUTILE en production**
3. ❌ Comptage total services - **INUTILE si on retourne déjà la liste**
4. ✅ Requête principale - **NÉCESSAIRE**

#### b) Pas d'optimisation de la requête principale
```sql
SELECT id, data, is_active, created_at 
FROM services 
WHERE user_id = $1 
ORDER BY created_at DESC
```

**Problèmes :**
- Retourne le champ `data` JSONB **complet** (6.5 MB par service)
- Pas de limite (même si seulement 1 service)
- Pas de projection des champs nécessaires uniquement

#### c) Pas de cache
Chaque appel refait toutes les requêtes même si les données n'ont pas changé.

---

### 3. ⚠️ PROBLÈME : Données non filtrées

**Code actuel :**
```rust
let result: Vec<_> = rows
    .into_iter()
    .map(|r| {
        json!({
            "id": r.id,
            "data": serde_json::from_value(r.data).unwrap_or(Value::Null),  // ❌ TOUT le data
            "actif": r.is_active,
            "created_at": r.created_at
        })
    })
    .collect();
```

**Problème :** Le champ `data` complet est retourné, incluant probablement :
- Produits avec images base64
- Médias volumineux
- Données Google Places complètes
- Autres données non nécessaires pour la liste

---

## Solutions proposées

### Solution 1 : Créer une version allégée pour la liste

**Créer une fonction qui retourne seulement les champs nécessaires :**
- `id`
- `titre_service` (extrait de data)
- `description` (extrait de data, tronqué à 200 caractères)
- `category`
- `is_active`
- `created_at`
- `produits` (seulement nom, prix, is_active - pas les images/médias)

### Solution 2 : Supprimer les requêtes SQL inutiles

**Supprimer :**
- Requête debug (derniers 5 services)
- Comptage total (déjà disponible via `rows.len()`)

### Solution 3 : Optimiser la requête SQL

**Utiliser une projection SQL pour extraire seulement les champs nécessaires :**
```sql
SELECT 
    id,
    data->>'titre_service' as titre_service,
    data->'titre_service'->>'valeur' as titre_service_valeur,
    LEFT(data->>'description', 200) as description_preview,
    category,
    is_active,
    created_at,
    -- Produits allégés (sans images/médias)
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'nom', product->>'nom',
                'prix', product->>'prix',
                'is_active', COALESCE(
                    (SELECT is_active FROM products_lifecycle 
                     WHERE service_id = s.id AND product_index = idx), 
                    true
                )
            )
        )
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(data->'produits') = 'array' THEN data->'produits'
                WHEN jsonb_typeof(data->'produits'->'valeur') = 'array' THEN data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) WITH ORDINALITY AS t(product, idx)
    ) as produits_light
FROM services 
WHERE user_id = $1 
ORDER BY created_at DESC
```

### Solution 4 : Créer un endpoint séparé pour les détails

**Endpoint actuel :** `/api/prestataire/services` → Liste allégée
**Nouveau endpoint :** `/api/prestataire/services/{id}/full` → Détails complets

Cela permet de :
- Charger rapidement la liste (données allégées)
- Charger les détails complets seulement quand nécessaire

### Solution 5 : Implémenter un cache

**Cache les résultats pendant 30-60 secondes** pour éviter de refaire les requêtes à chaque appel.

---

## Impact attendu

### Avant optimisation :
- Taille réponse : **6.5 MB** pour 1 service
- Temps réponse : **800ms** en moyenne
- Requêtes SQL : **4 requêtes**

### Après optimisation :
- Taille réponse : **< 50 KB** pour 1 service (réduction de 99%)
- Temps réponse : **< 100ms** (réduction de 87%)
- Requêtes SQL : **1 requête** (réduction de 75%)

---

## Plan d'action

1. ✅ Analyser le problème (fait)
2. ⏳ Créer une version allégée de la requête SQL
3. ⏳ Supprimer les requêtes SQL inutiles
4. ⏳ Implémenter la projection SQL pour extraire seulement les champs nécessaires
5. ⏳ Tester et mesurer l'amélioration

---

## Notes techniques

### Champs nécessaires pour la liste "Mes Services" :
- `id` : Identifiant du service
- `titre` : Titre du service (pour affichage)
- `description_preview` : Aperçu de la description (200 caractères max)
- `category` : Catégorie
- `is_active` : Statut actif/inactif
- `created_at` : Date de création
- `produits_count` : Nombre de produits (optionnel)
- `produits_light` : Liste allégée des produits (nom, prix, is_active uniquement)

### Champs à exclure de la liste :
- Images base64 complètes
- Vidéos
- Données Google Places complètes (garder seulement place_id si nécessaire)
- Descriptions complètes (garder seulement preview)
- Médias volumineux
- Autres données non essentielles pour la liste

