# 🔍 Analyse des Erreurs - Log 51

## ❌ **Nouvelles Erreurs Identifiées**

### 1. **`e.event_id` n'existe pas dans `global_promo_entries`**
- **Erreur** : `column e.event_id does not exist`
- **Cause** : Incohérence entre migrations
  - Migration `00000016` : colonne `promo_event_id`
  - Migration `0000_create_all_tables.sql` : colonne `event_id`
  - Le code Rust utilise `event_id`
- **Solution** : Renommer `promo_event_id` → `event_id` OU vérifier quelle colonne existe réellement

### 2. **`lfs.stock_target` n'existe pas dans `live_flash_sales`**
- **Erreur** : `column lfs.stock_target does not exist`
- **Cause** : Colonne manquante dans la table
- **Solution** : Ajouter la colonne `stock_target`

### 3. **`payload` n'existe pas dans `social_publication_jobs`**
- **Erreur** : `column "payload" does not exist`
- **Cause** : Colonne manquante dans la table
- **Solution** : Ajouter la colonne `payload`

### 4. **Redis : Timeout de connexion**
- **Erreur** : `Redis connection failed: Connection timeout (3s)`
- **Cause** : REDIS_URL mis à jour mais le service n'a peut-être pas encore redémarré avec le nouveau secret, OU problème de Security Groups
- **Solution** : Vérifier que le service a bien redémarré et que les Security Groups autorisent la connexion

---

## ✅ **Script de Correction SQL**

Voir `COMMANDE_CORRIGER_NOUVELLES_ERREURS_EC2.md`

