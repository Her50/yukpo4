# 🚨 PROBLÈMES CRITIQUES - Recherche par Image

## Date : 2025-11-01

---

## ❌ PROBLÈME #1 : PROMPT DIFFÉRENT (CRITIQUE)

### Prompt Création de Service
**Fichier** : `backend/ia_prompts/creation_service_prompt.md` (1169 lignes)
- ✅ Génère JSON structuré complet
- ✅ Inclut `type_offre`, autocomplete, champs complémentaires
- ✅ 6 catégories avec exemples (Immobilier, Auto, Électronique, etc.)
- ✅ Checklist de validation

### Prompt Recherche par Image  
**Fichier** : HARDCODÉ dans `hybrid_image_search_service.rs` ligne 111-149 (38 lignes)

```rust
let search_prompt = r#"
Tu es un expert en analyse multimodale pour la plateforme Yukpo.

GÉNÈRE UN JSON STRICTEMENT CONFORME pour la recherche d'un produit similaire :

**STRUCTURE OBLIGATOIRE :**
{
  "intention": "recherche_produit",  // ❌ Différent de "creation_service"
  "produits": {
    "type_donnee": "listeproduit",  // ❌ Différent de "autocomplete"
    "valeur": [
      {
        "nom": "...",
        "marque": "...",
        "couleurs": ["..."]
      }
    ]
  }
}
```

**DIFFÉRENCES CRITIQUES** :
- ❌ `intention` différente : "recherche_produit" vs "creation_service"
- ❌ `type_donnee` différent : "listeproduit" vs "autocomplete"
- ❌ Pas de `sous_caracteristiques` !
- ❌ Pas de `type_offre` !
- ❌ Pas de structure identique !

**CONSÉQUENCE** : Le matching ne peut PAS comparer les mêmes structures !

---

## ❌ PROBLÈME #2 : MATCHING NE UTILISE PAS autocomplete_characteristics

### Code actuel (ligne 347-370)

```rust
let rows = sqlx::query(
    r#"
    SELECT * FROM hybrid_image_search(
        $1::TEXT,    -- search_query
        $2::TEXT,    -- category_filter
        $3::TEXT,    -- marque
        $4::TEXT,    -- couleur_principale
        $5::TEXT[],  -- tous_tags
        $6::FLOAT,   -- gps_lat
        $7::FLOAT,   -- gps_lng
        $8::INTEGER, -- search_radius_km
        $9::INTEGER  -- max_results
    )
    "#
)
```

**Fonction SQL `hybrid_image_search()`** :
- Cherche dans `image_analyses` (analyses stockées)
- Cherche dans `media.ai_*` (tags, description, marque)
- ❌ **NE CHERCHE PAS** dans `autocomplete_characteristics` !

**CONSÉQUENCE** : Ne match PAS sur les caractéristiques structurées (pointure, taille, carburant, etc.)

---

## ❌ PROBLÈME #3 : PROMPT INCOMPLET

### Ce qui MANQUE dans le prompt recherche :

1. **Pas d'autocomplete** :
```json
// ❌ ABSENT
"produits": {
  "type_donnee": "autocomplete",
  "valeur": ["Logitech,MX Master 3,Sans fil,Noir"],
  "separateur": ",",
  "sous_caracteristiques": {
    "marque": ["Logitech", "HP"],
    "modele": ["MX Master 3"],
    "connectivite": ["Sans fil", "Bluetooth"],
    "couleur": ["Noir", "Blanc"]
  }
}
```

2. **Pas de type_offre** :
```json
// ❌ ABSENT
"type_offre": {
  "type_donnee": "string",
  "valeur": "produit",
  "origine_champs": "ia"
}
```

3. **Pas de champs complémentaires** :
```json
// ❌ ABSENT
"dimensions": {...},
"garantie": {...},
"livraison_possible": {...}
```

---

## ❌ PROBLÈME #4 : MATCHING INCOMPLET

### Le matching actuel fait SEULEMENT :

```sql
-- 1. Match sur description/tags/marque/couleur
WHERE 
  ia.description ILIKE '%' || search_query || '%'
  OR ANY(ia.tags) ILIKE '%' || search_query || '%'
  OR ia.marque ILIKE '%' || marque || '%'
  OR ANY(ia.couleurs) ILIKE '%' || couleur || '%'
```

**MANQUE** :
- ❌ Matching sur `autocomplete_characteristics` (THE MOST IMPORTANT!)
- ❌ Matching sur modèle, taille, pointure, carburant, etc.
- ❌ Matching sur sous-caractéristiques structurées

---

## ✅ SOLUTION COMPLÈTE

### ÉTAPE 1 : Créer un prompt dédié recherche_image_prompt.md

**Fichier** : `backend/ia_prompts/recherche_image_prompt.md`

**Contenu** : Copie EXACTE de `creation_service_prompt.md` avec :
- ✅ MÊME structure JSON
- ✅ MÊME type_donnee autocomplete
- ✅ MÊME sous_caracteristiques
- ✅ MÊME type_offre obligatoire
- ✅ MÊME champs complémentaires

**CHANGEMENT** : Ajouter au début :
```markdown
# ⚠️ MODE : RECHERCHE PAR IMAGE (pas création)

## OBJECTIF
Tu analyses une image fournie par un UTILISATEUR QUI CHERCHE ce produit.

## DIFFÉRENCE AVEC CRÉATION
- L'utilisateur NE VEND PAS ce produit
- L'utilisateur CHERCHE À ACHETER/TROUVER ce produit
- Génère le JSON EXACTEMENT comme pour création, mais avec intention = "recherche_produit"

## FORMAT JSON
**IDENTIQUE À creation_service_prompt.md** avec autocomplete complet !
```

### ÉTAPE 2 : Modifier hybrid_image_search_service.rs

**Remplacer ligne 111-149** :
```rust
// ❌ AVANT : Prompt hardcodé incomplet
let search_prompt = r#"... 38 lignes ...

// ✅ APRÈS : Charger le prompt fichier
let search_prompt = tokio::fs::read_to_string("backend/ia_prompts/recherche_image_prompt.md")
    .await
    .unwrap_or_else(|_| {
        log_warn("[HybridImageSearch] Prompt fichier introuvable, utilisation prompt par défaut");
        include_str!("../../ia_prompts/recherche_image_prompt.md").to_string()
    });
```

### ÉTAPE 3 : Améliorer le matching pour utiliser autocomplete_characteristics

**Modifier la fonction SQL `hybrid_image_search()`** :

```sql
CREATE OR REPLACE FUNCTION hybrid_image_search(
    p_search_query TEXT,
    p_category_filter TEXT,
    p_marque TEXT,
    p_couleur TEXT,
    p_tags TEXT[],
    p_gps_lat FLOAT,
    p_gps_lng FLOAT,
    p_search_radius_km INTEGER,
    p_max_results INTEGER
)
RETURNS TABLE(...) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as service_id,
        ia.id as analysis_id,
        ...
        (
            -- Score sur analyses stockées
            CASE WHEN ia.description ILIKE '%' || p_search_query || '%' THEN 10.0 ELSE 0.0 END +
            CASE WHEN ia.marque ILIKE '%' || p_marque || '%' THEN 15.0 ELSE 0.0 END +
            ...
            +
            -- ✅ NOUVEAU : BOOST MAJEUR pour autocomplete_characteristics
            (
                SELECT COALESCE(SUM(
                    CASE ac.sous_caracteristique
                        WHEN 'marque' THEN 20.0
                        WHEN 'modele' THEN 18.0
                        WHEN 'couleur' THEN 12.0
                        ELSE 8.0
                    END *
                    (1.0 + (ac.usage_count::REAL / 10.0))
                ), 0.0)
                FROM autocomplete_characteristics ac
                WHERE ac.service_id = s.id
                AND ac.identifiant_base LIKE 'produit%'
                AND (
                    ac.valeur ILIKE '%' || p_search_query || '%'
                    OR ac.valeur ILIKE '%' || p_marque || '%'
                    OR ac.valeur ILIKE '%' || p_couleur || '%'
                    OR ac.valeur = ANY(p_tags)
                )
            )
        ) as match_score
    FROM services s
    LEFT JOIN image_analyses ia ON ia.service_id = s.id
    WHERE s.is_active = true
    ORDER BY match_score DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎯 RÉSULTAT ATTENDU APRÈS CORRECTIONS

### Recherche image "Souris Logitech noire"

#### AVANT ❌ :
```
Analyse IA → JSON incomplet → Matching partiel
- description match : 10.0
- marque "Logitech" match : 15.0
TOTAL : 25.0
```

#### APRÈS ✅ :
```
Analyse IA → JSON COMPLET (comme création) → Matching TOTAL
- description match : 10.0
- marque "Logitech" match : 15.0
- autocomplete marque "Logitech" : 20.0 × 1.8 = 36.0 🔥
- autocomplete couleur "Noir" : 12.0 × 1.8 = 21.6 🔥
- autocomplete connectivité "Sans fil" : 10.0 × 1.8 = 18.0 🔥
TOTAL : 110.6 (4.4x meilleur !)
```

---

**VOULEZ-VOUS QUE JE CRÉÉ TOUTES CES CORRECTIONS MAINTENANT ?** 🚀

1. Créer `recherche_image_prompt.md` (copie de création avec adaptations)
2. Modifier `hybrid_image_search_service.rs` pour charger le prompt
3. Améliorer la fonction SQL pour utiliser autocomplete_characteristics
4. Vérifier la migration SQLx offline (je le ferai aussi)

