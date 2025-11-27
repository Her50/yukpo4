# Analyse des erreurs de déploiement - 2025-11-27

## 🔴 Erreurs critiques

### 1. Migration SQLx modifiée
```
migration 0 was previously applied but has been modified
```
**Problème** : La migration `0000_create_all_tables.sql` a été modifiée alors qu'elle était déjà appliquée.

**Solution** : Ne jamais modifier une migration déjà appliquée. Créer une nouvelle migration pour les changements.

---

### 2. Tables spécialisées n'existent pas
```
relation "pharmacies" does not exist
relation "banques_sang" does not exist
```

**Problème** : Le code dans `auto_migrate.rs` ligne 9406-9464 essaie d'exécuter des UPDATE sur les tables `pharmacies`, `banques_sang`, etc. dans un bloc `DO $$`, mais ces tables n'existent pas encore.

**Localisation** : `backend/src/migrations/auto_migrate.rs:9406-9464`

**Solution** : Vérifier si les tables existent avant d'exécuter les UPDATE :

```rust
// Remplir depuis les tables spécialisées existantes (en utilisant DO $$ blocks)
// Vérifier d'abord si les tables existent
let pharmacies_exists = sqlx::query_scalar::<_, bool>(
    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacies')"
)
.fetch_one(pool)
.await
.unwrap_or(false);

if pharmacies_exists {
    sqlx::query(
        r#"
        DO $$
        BEGIN
            -- Pharmacies
            UPDATE services s
            SET specialized_type = 'pharmacie'
            WHERE EXISTS (
                SELECT 1 FROM pharmacies p WHERE p.service_id = s.id
            )
            AND specialized_type IS NULL;
        END
        $$;
        "#
    )
    .execute(pool)
    .await?;
}
// Répéter pour chaque table...
```

---

### 3. Erreur de syntaxe SQL avec IF
```
syntax error at or near "IF"
```

**Problème** : Plusieurs endroits utilisent `IF` dans des blocs SQL sans la bonne syntaxe PostgreSQL.

**Localisations possibles** :
- `backend/src/migrations/auto_migrate.rs:9518` - Triggers specialized_type
- `backend/src/migrations/auto_migrate.rs:9171` - Intégration tickets bus
- `backend/src/migrations/auto_migrate.rs:9199` - Validation tickets bus

**Solution** : Vérifier que tous les blocs `DO $$` utilisent la syntaxe correcte :
```sql
DO $$
BEGIN
    IF condition THEN
        -- code
    END IF;
END
$$;
```

---

### 4. Erreur dollar-quoted string non terminée
```
unterminated dollar-quoted string at or near "$$ LANGUAGE plpgsql;
```

**Problème** : Dans la fonction `match_return_trip_requests`, il y a un problème avec les dollar-quoted strings.

**Localisation** : `backend/src/migrations/auto_migrate.rs:9333` - Fonction `match_return_trip_requests`

**Solution** : Vérifier que tous les blocs `$$` sont correctement fermés et qu'il n'y a pas de conflit avec les commentaires.

---

### 5. Erreur syntaxe SQL avec "lat"
```
syntax error at or near "lat"
```

**Problème** : Dans `20251126_fix_search_services_gps_final_signature.sql`, la déclaration de `lat` et `lng` dans le `DECLARE` peut causer des problèmes si elles sont utilisées dans un contexte incorrect.

**Localisation** : `backend/migrations/20251126_fix_search_services_gps_final_signature.sql:35-36`

**Solution** : Vérifier que les variables sont correctement déclarées et utilisées.

---

### 6. Index n'existent pas
```
relation "idx_services_produits_gin" does not exist
relation "idx_products_lifecycle_service_product_active" does not exist
```

**Problème** : Le code essaie de supprimer ou modifier des index qui n'existent pas.

**Localisations** :
- `backend/src/migrations/auto_migrate.rs:9550` - Index recherche
- `backend/src/migrations/auto_migrate.rs:9566` - Index performance

**Solution** : Utiliser `DROP INDEX IF EXISTS` au lieu de `DROP INDEX`.

---

### 7. Tables n'existent pas (bus, banques de sang)
```
relation "bus_boarding_status" does not exist
relation "bus_seat_blocks" does not exist
relation "user_blood_groups" does not exist
relation "agency_departure_schedules" does not exist
column "return_time" does not exist
```

**Problème** : Le code essaie d'accéder à des tables/colonnes qui n'existent pas encore.

**Solution** : Vérifier l'existence avant d'utiliser :
```sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bus_boarding_status') THEN
        -- code
    END IF;
END
$$;
```

---

## ⚠️ Erreurs non-critiques (warnings)

### 8. Redis TLS non activé
```
can't connect with TLS, the feature is not enabled
```

**Problème** : L'URL Redis utilise `redis://` au lieu de `rediss://` pour TLS.

**Solution** : Changer l'URL Redis dans les variables d'environnement de `redis://` à `rediss://` pour Upstash.

---

### 9. LiveKit non accessible
```
LiveKit: Connexion impossible
```

**Problème** : Le serveur LiveKit n'est pas accessible (service optionnel).

**Impact** : Non-critique, le service continue de fonctionner.

---

## 📋 Plan de correction

### Priorité 1 (Bloquant)
1. ✅ Corriger la vérification d'existence des tables avant UPDATE dans `auto_migrate.rs:9406-9464`
2. ✅ Corriger les erreurs de syntaxe SQL avec IF
3. ✅ Corriger l'erreur dollar-quoted string dans `match_return_trip_requests`
4. ✅ Utiliser `DROP INDEX IF EXISTS` pour les index

### Priorité 2 (Important)
5. ✅ Vérifier l'existence des tables avant utilisation (bus, banques de sang)
6. ✅ Corriger l'URL Redis pour TLS

### Priorité 3 (Optionnel)
7. ⚠️ Vérifier la connexion LiveKit (service optionnel)

---

## 🔧 Corrections à appliquer

### Correction 1 : Vérification des tables avant UPDATE

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Ligne** : ~9405

**Avant** :
```rust
// Remplir depuis les tables spécialisées existantes (en utilisant DO $$ blocks)
sqlx::query(
    r#"
    DO $$
    BEGIN
        -- Pharmacies
        UPDATE services s
        SET specialized_type = 'pharmacie'
        WHERE EXISTS (
            SELECT 1 FROM pharmacies p WHERE p.service_id = s.id
        )
        AND specialized_type IS NULL;
        // ...
    END
    $$;
    "#
)
.execute(pool)
.await?;
```

**Après** :
```rust
// Remplir depuis les tables spécialisées existantes (vérifier existence d'abord)
let tables_to_check = vec![
    ("pharmacies", "pharmacie"),
    ("hopitaux_cliniques", "hopital_clinique"),
    ("laboratoires_imagerie", "laboratoire_imagerie"),
    ("agences_voyage", "agence_voyage"),
    ("covoiturages", "covoiturage"),
    ("taxis_ville", "taxi_ville"),
    ("banques_sang", "banque_sang"),
];

for (table_name, specialized_type) in tables_to_check {
    let table_exists: bool = sqlx::query_scalar(
        &format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '{}')",
            table_name
        )
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);
    
    if table_exists {
        sqlx::query(&format!(
            r#"
            UPDATE services s
            SET specialized_type = '{}'
            WHERE EXISTS (
                SELECT 1 FROM {} p WHERE p.service_id = s.id
            )
            AND specialized_type IS NULL
            "#,
            specialized_type, table_name
        ))
        .execute(pool)
        .await?;
    }
}
```

---

### Correction 2 : Utiliser DROP INDEX IF EXISTS

**Fichier** : `backend/src/migrations/auto_migrate.rs` et fichiers SQL de migration

**Remplacer** :
```sql
DROP INDEX idx_services_produits_gin;
```

**Par** :
```sql
DROP INDEX IF EXISTS idx_services_produits_gin;
```

---

### Correction 3 : Vérifier existence des tables avant utilisation

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Pour chaque table/colonne manquante**, ajouter une vérification :
```rust
let table_exists: bool = sqlx::query_scalar(
    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'table_name')"
)
.fetch_one(pool)
.await
.unwrap_or(false);

if table_exists {
    // Code qui utilise la table
}
```

---

## ✅ Notes

- Les erreurs de migration SQLx (migration 0 modifiée) nécessitent une nouvelle migration
- La plupart des erreurs sont dues à des vérifications d'existence manquantes
- Le service fonctionne malgré ces erreurs (elles sont catchées et loggées)
- Les corrections doivent être testées localement avant déploiement

