# Analyse : Services Spécialisés - Identification et Ambiguïté

## 🔍 Problème Identifié

### Architecture Actuelle

1. **Table `services` (table générique)** :
   - Contient TOUS les services (génériques + spécialisés)
   - Champ `category` : Optionnel, peut être généré librement par l'IA
   - Champ `data` (JSONB) : Contient les données dynamiques du service
   - Utilisé pour la recherche unifiée, embeddings, media, etc.

2. **Tables spécialisées** :
   - `pharmacies` → `service_id` REFERENCES `services(id)`
   - `hopitaux_cliniques` → `service_id` REFERENCES `services(id)`
   - `laboratoires_imagerie` → `service_id` REFERENCES `services(id)`
   - `agences_voyage` → `service_id` REFERENCES `services(id)`
   - `covoiturages` → `service_id` REFERENCES `services(id)`
   - `taxis_ville` → `service_id` REFERENCES `services(id)`
   - `banques_sang` → `service_id` REFERENCES `services(id)`

### Pourquoi Sauvegarder dans `services` ?

✅ **Avantages** :
1. **Recherche unifiée** : Tous les services dans une seule table pour recherche fulltext, embeddings, etc.
2. **Fonctionnalités communes** : Media, embedding, reviews, interactions, etc.
3. **Cohérence** : Un seul point d'entrée pour tous les services
4. **Performance** : Index unifiés sur `services` pour recherche rapide

### ❌ Problème d'Ambiguïté

**Scénario problématique** :

1. **Service générique créé par l'IA** :
   ```json
   {
     "id": 123,
     "category": "pharmacie",  // ← Généré par l'IA
     "data": {
       "titre_service": {"valeur": "Vente de médicaments"},
       "category": {"valeur": "pharmacie"}
     }
   }
   ```
   → **PAS d'entrée dans `pharmacies`**

2. **Service spécialisé** :
   ```json
   {
     "id": 456,
     "category": "pharmacie",  // ← Même catégorie
     "data": {
       "titre_service": {"valeur": "Pharmacie Centrale"},
       "category": {"valeur": "pharmacie"}
     }
   }
   ```
   → **ENTRÉE dans `pharmacies` avec `service_id = 456`**

**Problème** : Comment distinguer les deux sans vérifier l'existence dans `pharmacies` ?

## 🔎 Analyse du Code

### 1. Identification Actuelle

**Aucun mécanisme fiable d'identification** :
- ❌ Pas de champ `is_specialized` dans `services`
- ❌ Pas de champ `specialized_type` dans `services`
- ❌ La catégorie n'est PAS fiable (générée librement par l'IA)
- ✅ Seule vérification : Existence dans table spécialisée (coûteux)

### 2. Recherche Spécialisée

**Dans `scheduling_search_service.rs`** :
```rust
pub fn analyze_search_intent(&self, query: &str) -> SearchIntent {
    // Détection basée sur la QUERY, pas sur la catégorie du service
    if query_lower.contains("pharmacie") {
        return SearchIntent::SpecializedPharmacy;
    }
    // ...
}
```

**Problème** : La recherche spécialisée se base sur l'**intention de recherche** (query), pas sur le **type réel du service**.

### 3. Création de Services Spécialisés

**Dans `pharmacy_controller.rs`** :
```rust
pub async fn create_pharmacy(
    // ...
    Json(payload): Json<CreatePharmacyRequest>,
) -> AppResult<impl IntoResponse> {
    // Vérifie que service_id existe et appartient à l'utilisateur
    let service_exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM services WHERE id = $1 AND user_id = $2"
    )
    // ...
    // Insère dans pharmacies avec service_id
    // MAIS ne marque PAS le service comme spécialisé
}
```

**Problème** : Aucun marquage du service comme spécialisé lors de la création.

## 💡 Solutions Proposées

### Solution 1 : Champ `specialized_type` (RECOMMANDÉ)

**Avantages** :
- ✅ Identification immédiate sans JOIN
- ✅ Pas d'ambiguïté
- ✅ Performance optimale
- ✅ Compatible avec recherche unifiée

**Implémentation** :

```sql
-- Migration
ALTER TABLE services 
ADD COLUMN specialized_type VARCHAR(50) NULL;

-- Contrainte
ALTER TABLE services 
ADD CONSTRAINT check_specialized_type 
CHECK (specialized_type IS NULL OR specialized_type IN (
    'pharmacie',
    'hopital_clinique',
    'laboratoire_imagerie',
    'agence_voyage',
    'covoiturage',
    'taxi_ville',
    'banque_sang'
));

-- Index
CREATE INDEX idx_services_specialized_type 
ON services(specialized_type) 
WHERE specialized_type IS NOT NULL;
```

**Mise à jour lors de création** :
```rust
// Dans create_pharmacy
sqlx::query(
    "UPDATE services SET specialized_type = 'pharmacie' WHERE id = $1"
)
.bind(payload.service_id)
.execute(&state.pg)
.await?;
```

**Recherche** :
```sql
-- Services spécialisés uniquement
SELECT * FROM services 
WHERE specialized_type = 'pharmacie' 
AND is_active = TRUE;

-- Services génériques uniquement
SELECT * FROM services 
WHERE specialized_type IS NULL 
AND category = 'pharmacie';
```

### Solution 2 : Vue Matérialisée (Alternative)

**Avantages** :
- ✅ Pas de modification de schéma
- ✅ Vue unifiée des services spécialisés

**Implémentation** :
```sql
CREATE MATERIALIZED VIEW services_specialized AS
SELECT 
    s.id,
    s.user_id,
    s.category,
    s.data,
    s.is_active,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pharmacies p WHERE p.service_id = s.id) THEN 'pharmacie'
        WHEN EXISTS (SELECT 1 FROM hopitaux_cliniques h WHERE h.service_id = s.id) THEN 'hopital_clinique'
        -- ...
        ELSE NULL
    END as specialized_type
FROM services s;
```

**Inconvénients** :
- ❌ Nécessite rafraîchissement périodique
- ❌ Performance moindre (EXISTS pour chaque ligne)
- ❌ Plus complexe à maintenir

### Solution 3 : Table de Mapping (Alternative)

**Avantages** :
- ✅ Normalisation stricte
- ✅ Historique possible

**Implémentation** :
```sql
CREATE TABLE service_specialized_types (
    service_id INTEGER PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    specialized_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Inconvénients** :
- ❌ Nécessite JOIN supplémentaire
- ❌ Plus de complexité

## 🎯 Recommandation : Solution 1

### Plan d'Implémentation

1. **Migration** :
   ```sql
   -- Ajouter colonne
   ALTER TABLE services ADD COLUMN specialized_type VARCHAR(50) NULL;
   
   -- Remplir depuis tables existantes
   UPDATE services s
   SET specialized_type = 'pharmacie'
   WHERE EXISTS (SELECT 1 FROM pharmacies p WHERE p.service_id = s.id);
   
   UPDATE services s
   SET specialized_type = 'hopital_clinique'
   WHERE EXISTS (SELECT 1 FROM hopitaux_cliniques h WHERE h.service_id = s.id);
   
   -- ... pour chaque type spécialisé
   
   -- Ajouter contrainte et index
   ALTER TABLE services 
   ADD CONSTRAINT check_specialized_type 
   CHECK (specialized_type IS NULL OR specialized_type IN (...));
   
   CREATE INDEX idx_services_specialized_type 
   ON services(specialized_type) 
   WHERE specialized_type IS NOT NULL;
   ```

2. **Mise à jour des contrôleurs** :
   - `create_pharmacy` → Mettre à jour `specialized_type = 'pharmacie'`
   - `create_hospital` → Mettre à jour `specialized_type = 'hopital_clinique'`
   - ... pour chaque type

3. **Mise à jour de la recherche** :
   ```rust
   // Filtrer par specialized_type au lieu de catégorie
   let specialized_services = sqlx::query_as::<_, Service>(
       "SELECT * FROM services WHERE specialized_type = $1"
   )
   .bind("pharmacie")
   .fetch_all(&pool)
   .await?;
   ```

4. **Validation** :
   - S'assurer qu'un service ne peut avoir qu'un seul `specialized_type`
   - S'assurer que `specialized_type` correspond à l'entrée dans la table spécialisée

## 🔒 Garanties d'Identification Sans Ambiguïté

Avec la **Solution 1** :

1. **Identification immédiate** :
   ```sql
   -- Service spécialisé ?
   SELECT specialized_type FROM services WHERE id = 123;
   -- → 'pharmacie' ou NULL
   ```

2. **Recherche fiable** :
   ```sql
   -- Toutes les pharmacies spécialisées
   SELECT * FROM services 
   WHERE specialized_type = 'pharmacie';
   
   -- Services génériques avec catégorie "pharmacie"
   SELECT * FROM services 
   WHERE specialized_type IS NULL 
   AND category = 'pharmacie';
   ```

3. **Contrainte d'intégrité** :
   ```sql
   -- Trigger pour garantir cohérence
   CREATE OR REPLACE FUNCTION check_specialized_service_consistency()
   RETURNS TRIGGER AS $$
   BEGIN
       IF NEW.specialized_type = 'pharmacie' THEN
           IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE service_id = NEW.id) THEN
               RAISE EXCEPTION 'Service spécialisé pharmacie doit avoir entrée dans pharmacies';
           END IF;
       END IF;
       -- ... pour chaque type
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

## 📊 Comparaison des Solutions

| Critère | Solution 1 (champ) | Solution 2 (vue) | Solution 3 (mapping) |
|---------|-------------------|------------------|---------------------|
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Simplicité | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Maintenance | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Pas d'ambiguïté | ✅ | ✅ | ✅ |
| Coût migration | Faible | Faible | Moyen |

## ✅ Conclusion

**Recommandation** : Implémenter la **Solution 1** avec le champ `specialized_type`.

**Avantages clés** :
- ✅ Identification sans ambiguïté
- ✅ Performance optimale (pas de JOIN)
- ✅ Compatible avec recherche unifiée
- ✅ Facile à maintenir
- ✅ Permet de distinguer services génériques et spécialisés avec même catégorie

**Prochaines étapes** :
1. Créer migration SQL
2. Mettre à jour contrôleurs de création
3. Mettre à jour recherche
4. Ajouter validation/contraintes
5. Tests de régression

