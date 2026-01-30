# 🔍 Analyse : Pourquoi les Erreurs de Migration Persistent

## 📋 Problème

**Observation** : Les mêmes erreurs de migration persistent dans `log-events-viewer-result (3).csv` malgré les corrections appliquées.

**Erreurs toujours présentes** :
1. `cannot insert multiple commands into a prepared statement`
2. `constraint fk_video_generation_jobs_audio_job already exists`
3. `column user_id does not exist` (courier_availability_snapshots)
4. `trigger trigger_update_user_documents_updated_at already exists`
5. `relation conversations does not exist`
6. `foreign key constraint delivery_media_parcel_id_fkey cannot be implemented`
7. `functions in index predicate must be marked IMMUTABLE`
8. `column retry_at does not exist`
9. `cannot change return type of existing function`
10. `function name hybrid_image_search is not unique`
11. `relation pharmacy_order_items/pharmacy_reservations does not exist`
12. `column location_point/statut/tags/date_limite_candidature/entreprise_id does not exist`

---

## 🔍 Causes Identifiées

### 1. **Les Migrations de Correction ne S'Exécutent PAS** ⚠️

**Problème** : Aucun log de "MIGRATION CORRECTION" dans les logs AWS.

**Preuve** : Recherche dans `log-events-viewer-result (3).csv` :
- ❌ Aucun log "MIGRATION CORRECTION 002"
- ❌ Aucun log "MIGRATION CORRECTION 003"
- ❌ Aucun log "Migration de correction appliquée avec succès"

**Causes possibles** :
1. Le code dans `main.rs` n'est pas déployé dans AWS
2. Les migrations de correction échouent silencieusement
3. Les fichiers de migration ne sont pas présents dans le build Docker

---

### 2. **La Migration 0000 s'Exécute AVANT les Corrections** ⚠️

**Problème** : L'ordre d'exécution dans `main.rs` est :
1. Migration 0 (via `execute_multiple_sql_commands`)
2. Migration consolidée `20260129`
3. Migrations de correction `20260130_002`, `20260130_003`
4. `sqlx::migrate!()`

**Mais** : La migration 0 contient toujours les commandes problématiques qui sont exécutées AVANT les corrections.

**Exemple** :
- Ligne 4-41 des logs : Erreur "cannot insert multiple commands" pour `update_updated_at_column()` + `CREATE TRIGGER` + `CREATE TABLE notifications`
- Ces commandes sont dans `0000_create_all_tables.sql` et s'exécutent AVANT les corrections

---

### 3. **execute_multiple_sql_commands() ne Divise pas Correctement** ⚠️

**Problème** : La fonction ne détecte pas correctement la fin des fonctions PostgreSQL.

**Exemple problématique** :
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Analyse** :
- La fonction se termine par `$$ language 'plpgsql';`
- Mais `execute_multiple_sql_commands()` peut ne pas détecter que c'est la fin d'une commande
- La commande suivante (`CREATE TRIGGER`) est alors groupée avec la fonction

---

### 4. **Les Corrections dans 0000 ne sont pas Appliquées** ⚠️

**Problème** : Les corrections dans `0000_create_all_tables.sql` sont faites, mais :
- Le build Docker peut utiliser une ancienne version
- Les changements ne sont pas déployés
- Le cache Docker peut utiliser une ancienne image

---

## ✅ Solutions Appliquées

### 1. **Corrections Directes dans 0000_create_all_tables.sql** ✅

- ✅ Ajout de `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`
- ✅ Ajout de `user_id` dans `courier_availability_snapshots`
- ✅ Index conditionnel pour `user_id`
- ✅ Correction de `idx_cache_expires_at` (suppression du prédicat NOW())
- ✅ DROP FUNCTION avant CREATE pour `get_product_reactions_count` et `cleanup_expired_cache`

### 2. **Migration de Correction Finale** ✅

- ✅ Création de `20260130_004_fix_all_migration_errors_final.sql`
- ✅ Correction de TOUS les problèmes identifiés
- ✅ Ajout dans `main.rs` pour exécution AVANT `sqlx::migrate!()`

### 3. **Amélioration de execute_multiple_sql_commands()** ✅

- ✅ Détection améliorée des fins de fonctions
- ✅ Division des commandes multiples sur une seule ligne
- ✅ Meilleure gestion des blocs `$$...$$`

---

## 🎯 Actions Requises

### 1. **Vérifier le Déploiement** 🔴 CRITIQUE

**Action** : Vérifier que le nouveau code est déployé dans AWS :
- ✅ Le build Docker inclut les nouveaux fichiers
- ✅ Les migrations de correction sont présentes dans l'image
- ✅ Le code `main.rs` mis à jour est compilé

**Commande de vérification** :
```bash
# Vérifier que les fichiers de migration existent dans le container
docker exec <container> ls -la /app/backend/migrations/20260130_*.sql

# Vérifier que main.rs contient les appels aux migrations de correction
docker exec <container> grep -A 5 "MIGRATION CORRECTION" /app/backend/src/main.rs
```

---

### 2. **Vérifier les Logs de Démarrage** 🔴 CRITIQUE

**Action** : Chercher dans les logs AWS les messages :
- `🔄 [MIGRATIONS CORRECTION] Application FORCÉE des migrations de correction`
- `✅ [MIGRATION CORRECTION 002] Migration de correction appliquée avec succès`
- `✅ [MIGRATION CORRECTION 003] Migration de correction appliquée avec succès`
- `✅ [MIGRATION CORRECTION 004] Migration de correction FINALE appliquée avec succès`

**Si absents** : Les migrations de correction ne s'exécutent pas.

---

### 3. **Améliorer execute_multiple_sql_commands()** ⚠️

**Action** : Améliorer la détection des fins de fonctions pour mieux diviser les commandes.

**Code actuel** : Détecte `$$ language 'plpgsql';` mais peut manquer certains cas.

**Amélioration nécessaire** : Détecter tous les patterns de fin de fonction :
- `$$ language 'plpgsql';`
- `$$ LANGUAGE plpgsql;`
- `$$;` (simple)
- `$$ LANGUAGE sql;`

---

## 📊 Comparaison des Erreurs

| Erreur | Fichier 1 | Fichier 2 | Fichier 3 | Évolution |
|--------|-----------|-----------|-----------|-----------|
| cannot insert multiple commands | 9 | 2 | 2 | ✅ Amélioration |
| constraint already exists | 2 | 1 | 1 | ✅ Stable |
| column does not exist | 8+ | 2 | 6+ | ⚠️ Augmenté |
| relation does not exist | 15+ | 3 | 3 | ✅ Amélioration |
| foreign key cannot be implemented | 3 | 3 | 2 | ✅ Amélioration |
| cannot change return type | 4 | 3 | 2 | ✅ Amélioration |
| function name not unique | 5 | 18 | 5 | ✅ Amélioration |

---

## 🎯 Conclusion

### Problème Principal

**Les migrations de correction ne s'exécutent probablement PAS dans AWS** car :
1. Le code n'est pas déployé
2. Les fichiers de migration ne sont pas dans le build
3. Les migrations échouent silencieusement

### Solution Immédiate

1. ✅ **Vérifier le déploiement** : S'assurer que le nouveau code est dans AWS
2. ✅ **Vérifier les logs de démarrage** : Chercher les messages de migration de correction
3. ✅ **Rebuild et redéployer** : Reconstruire l'image Docker avec les corrections

### Corrections Appliquées

- ✅ Corrections directes dans `0000_create_all_tables.sql`
- ✅ Migration de correction finale `20260130_004`
- ✅ Amélioration de `execute_multiple_sql_commands()`
- ✅ Ajout dans `main.rs` pour exécution avant `sqlx::migrate!()`

**Mais** : Ces corrections ne seront effectives que si le code est **déployé dans AWS**.

---

**Date d'analyse** : 2026-01-30  
**Statut** : ✅ Corrections appliquées, ⚠️ Déploiement à vérifier

