# 🔍 Diagnostic Migrations AWS - 30 Janvier 2026

## 📊 Résumé des Problèmes Identifiés

D'après les logs d'erreur PostgreSQL, **plusieurs tables et fonctions ne sont pas correctement créées** dans la base de données AWS. Voici les problèmes principaux :

### ❌ Problèmes Critiques

1. **Fonction `hybrid_image_search` non unique**
   - Plusieurs versions de la fonction existent avec des signatures différentes
   - Erreur: `function name "hybrid_image_search" is not unique`
   - **Solution**: Supprimer toutes les versions et recréer une seule version

2. **Type incompatible: `pharmacy_products.id`**
   - `pharmacy_products` utilise `SERIAL` (INTEGER)
   - `pharmacy_order_items` et `pharmacy_reservations` référencent avec UUID
   - Erreur: `Key columns "medication_id" and "id" are of incompatible types: uuid and integer`
   - **Solution**: Corriger les références pour utiliser INTEGER

3. **Table `specialized_reservations` manquante**
   - Référencée par `covoiturage_insurance` et `reservation_qr_codes`
   - Erreur: `relation "specialized_reservations" does not exist`
   - **Solution**: Créer la table si elle n'existe pas

4. **Colonnes manquantes dans `offres_emploi`**
   - `statut` (existe mais les index échouent)
   - `location_point` (peut manquer si PostGIS n'est pas installé)
   - `tags`, `date_limite_candidature`, `entreprise_id`
   - **Solution**: Vérifier et ajouter les colonnes manquantes

5. **Colonne `user_id` manquante dans `courier_availability_snapshots`**
   - Erreur: `column "user_id" does not exist`
   - **Solution**: Supprimer l'index problématique ou ajouter la colonne

6. **Erreur de syntaxe dans `programmes_scolaires`**
   - Virgule en trop avant la fermeture de la table
   - Erreur: `syntax error at or near ")"`
   - **Solution**: Corriger la syntaxe

7. **Vues matérialisées échouent**
   - `services_search_cache` et `active_products_cache` échouent car `gps` n'existe pas
   - **Note**: La colonne `gps` existe dans `services` selon la migration 0000, donc c'est probablement un problème d'ordre d'exécution

8. **Plusieurs commandes dans un prepared statement**
   - Certaines migrations contiennent plusieurs commandes séparées par `;`
   - Erreur: `cannot insert multiple commands into a prepared statement`
   - **Solution**: Exécuter les commandes séparément

9. **Fonction `run_audio_cache_cleanup()` manquante**
   - Référencée mais non créée
   - **Solution**: Créer la fonction ou supprimer les références

10. **Index avec fonction non IMMUTABLE**
    - `idx_delivery_matching_queue_next_attempt_pending` utilise `NOW()` dans WHERE
    - Erreur: `functions in index predicate must be marked IMMUTABLE`
    - **Solution**: Supprimer la clause WHERE ou utiliser une approche différente

## ✅ Solutions Créées

Deux scripts SQL ont été créés pour diagnostiquer et corriger les problèmes :

### 1. `backend/scripts/diagnostic_migrations_aws.sql`
Script de diagnostic qui vérifie :
- Existence des tables critiques
- Types de colonnes (notamment `pharmacy_products.id`)
- Versions de `hybrid_image_search`
- Contraintes de clé étrangère
- Colonnes manquantes

### 2. `backend/scripts/fix_migrations_aws.sql`
Script de correction qui :
- Supprime les versions dupliquées de `hybrid_image_search`
- Crée `specialized_reservations` si manquante
- Corrige les types de `pharmacy_order_items` et `pharmacy_reservations`
- Ajoute les colonnes manquantes dans `offres_emploi`
- Corrige la syntaxe de `programmes_scolaires`
- Crée les tables dépendantes (`covoiturage_insurance`, `reservation_qr_codes`)
- Corrige les vues matérialisées
- Corrige les index problématiques

## 🚀 Comment Utiliser

### Étape 1: Diagnostic
```bash
# Se connecter à la base de données AWS
psql -h <host> -U yukpo_db_user -d yukpo_db -f backend/scripts/diagnostic_migrations_aws.sql
```

### Étape 2: Correction
```bash
# Appliquer les corrections
psql -h <host> -U yukpo_db_user -d yukpo_db -f backend/scripts/fix_migrations_aws.sql
```

### Étape 3: Vérification
```bash
# Vérifier à nouveau l'état
psql -h <host> -U yukpo_db_user -d yukpo_db -f backend/scripts/diagnostic_migrations_aws.sql
```

## 📋 Ordre d'Exécution Recommandé

1. **Exécuter le diagnostic** pour identifier tous les problèmes
2. **Examiner les résultats** du diagnostic
3. **Exécuter le script de correction**
4. **Vérifier à nouveau** avec le diagnostic
5. **Relancer les migrations** si nécessaire

## ⚠️ Notes Importantes

1. **Backup**: Faire un backup de la base de données avant d'exécuter les scripts de correction
2. **Downtime**: Certaines corrections peuvent nécessiter un court downtime
3. **Dépendances**: Certaines tables dépendent d'autres tables (ordre d'exécution important)
4. **PostGIS**: Certaines fonctionnalités nécessitent l'extension PostGIS

## 🔄 Prochaines Étapes

Après avoir appliqué les corrections :

1. Vérifier que toutes les tables existent
2. Vérifier que toutes les fonctions sont créées (une seule version de `hybrid_image_search`)
3. Vérifier que tous les index sont créés
4. Tester les fonctionnalités critiques (recherche, réservations, etc.)
5. Surveiller les logs pour d'éventuelles erreurs restantes

## 📝 Fichiers Créés

- `backend/scripts/diagnostic_migrations_aws.sql` - Script de diagnostic
- `backend/scripts/fix_migrations_aws.sql` - Script de correction
- `DIAGNOSTIC_MIGRATIONS_AWS_2026_01_30.md` - Ce document




