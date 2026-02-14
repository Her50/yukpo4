# 📊 Analyse des Erreurs - Log 52

## 🔴 Erreurs Identifiées

### 1. **Erreurs de Colonnes Manquantes (Persistantes)**
- `column e.event_id does not exist` - `global_promo_entries` (déjà corrigé mais revient)
- `column lfs.stock_target does not exist` - `live_flash_sales` (déjà corrigé mais revient)
- `column "payload" does not exist` - `social_publication_jobs` (déjà corrigé mais revient)

### 2. **Nouvelles Erreurs (Apparues après 08:07:03)**
- `column e.submitted_by_user_id does not exist` - `global_promo_entries`
- `column lfs.metadata does not exist` - `live_flash_sales`
- `column "status" does not exist` - `social_publication_jobs`

### 3. **Erreurs Redis (Persistantes)**
- `Redis connection failed: Connection timeout (3s) - tentative 3/3`
- Mode dégradé activé

---

## 📝 Résumé

**Total d'erreurs** : ~200 erreurs sur ~15 minutes

**Types d'erreurs** :
- **Colonnes manquantes** : 3 types persistants + 3 nouveaux types
- **Redis** : Timeouts constants (toutes les 10 secondes)

**Hypothèse** : Les corrections précédentes n'ont peut-être pas été appliquées correctement, ou de nouvelles requêtes utilisent d'autres colonnes.

