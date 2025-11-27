# Erreurs et Warnings Non Traités dans les Logs

## Analyse des logs `logbackend2.md`

### 1. ⚠️ Erreurs "Cannot read property 'Images'/'Videos' of undefined" (NON CORRIGÉES)

**Localisation dans les logs** :
- Ligne 170-175 : `Cannot read property 'Images' of undefined` et `Cannot read property 'Videos' of undefined`
- Ligne 188-190 : Même erreur répétée
- Source : Composant "unknown" (probablement un composant qui n'a pas de nom dans les logs)

**Composants identifiés utilisant `ImagePicker.MediaType.Images/Videos` sans protection** :
1. `mobile/src/components/ChatInputPanel.tsx` (lignes 105, 131)
2. `mobile/src/components/ChatModal.tsx` (ligne 229)
3. `mobile/src/components/BrandingManagerMobile.tsx` (ligne 45)
4. `mobile/src/components/ChaussureVariantManager.tsx` (ligne 85)
5. `mobile/src/components/ProductVariantManager.tsx` (ligne 114)
6. `mobile/src/components/HotelVariantManager.tsx` (ligne 115)
7. `mobile/src/components/PriceVariantSelector.tsx` (ligne 413)
8. `mobile/src/components/ChatInputMobile.tsx` (lignes 297, 338)
9. `mobile/src/components/ChatModalMobile.tsx` (ligne 611)
10. `mobile/src/screens/delivery/CourierRegistrationScreen.tsx` (ligne 151)
11. `mobile/src/screens/ProfileScreen.tsx` (lignes 124, 146)
12. `mobile/src/screens/CreatePubliciteScreen.tsx` (ligne 328)
13. `mobile/src/screens/specialized/CovoiturageFormScreen.tsx` (ligne 65)
14. `mobile/src/screens/specialized/TaxiFormScreen.tsx` (ligne 69)

**Solution** : Ajouter la même protection que dans `MediaUploadManager.tsx` :
```typescript
if (!ImagePicker || !ImagePicker.MediaType) {
  console.error('[ComponentName] ImagePicker ou MediaType est undefined');
  Alert.alert('Erreur', 'Impossible d\'accéder à la galerie. Veuillez réessayer.');
  return;
}
```

### 2. ⚠️ Erreurs 500 persistantes sur `/api/prestataire/services` (PARTIELLEMENT CORRIGÉES)

**Localisation dans les logs** :
- Ligne 77-78 : `[GET]500` avec `responseTimeMS=2248` et `responseTimeMS=1850`
- Ligne 81 : `[get_services_for_prestataire] Erreur requête SQL: error communicating with database: peer closed connection`
- Ligne 97 : Même erreur répétée

**Problème** :
- Même avec retry à 5 tentatives, les erreurs persistent
- La connexion DB se ferme pendant l'exécution de la requête (2.2s)
- Le pool de connexions peut être saturé

**Solutions possibles** :
1. Augmenter le timeout de connexion dans `main.rs`
2. Réduire le temps d'exécution de la requête SQL (optimisation supplémentaire)
3. Ajouter un circuit breaker pour éviter de surcharger la DB
4. Vérifier la configuration du pool de connexions Render

### 3. ⚠️ Warnings "slow statement" (PARTIELLEMENT CORRIGÉES)

**Localisation dans les logs** :
- Ligne 82 : `slow statement: execution time exceeded alert threshold` - `elapsed="2.246118534s"`
- Ligne 98 : Même warning - `elapsed="1.847702695s"`

**Problème** :
- La requête SQL prend toujours plus de 1 seconde malgré l'optimisation avec LATERAL JOIN
- La requête est toujours lente (2.2s et 1.8s)

**Solutions possibles** :
1. Vérifier que les index de la migration `20251127_optimize_services_queries_indexes.sql` ont été appliqués
2. Ajouter un index spécifique sur `services.user_id` + `services.created_at DESC`
3. Réduire le `LIMIT 200` si possible
4. Utiliser un cache Redis pour les résultats fréquents

### 4. ⚠️ Warning "there is no unique or exclusion constraint matching the ON CONFLICT specification" (MIGRATION NON APPLIQUÉE)

**Localisation dans les logs** :
- Ligne 222 : `[enrich_location] Erreur sauvegarde cache: error returned from database: there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Problème** :
- La migration `20251127_fix_geo_hierarchy_unique_constraint.sql` a été créée mais n'a pas été appliquée
- Le warning persiste dans les logs

**Solution** :
1. Vérifier que la migration a été exécutée : `sqlx migrate run`
2. Vérifier que la contrainte unique existe : `SELECT * FROM pg_constraint WHERE conname = 'geo_hierarchy_place_name_parent_country_key';`

### 5. ✅ Erreurs déjà corrigées (mais toujours présentes dans les logs car anciennes)

- Erreurs mobile "Cannot read property 'Images'/'Videos' of undefined" dans `MediaUploadManager` - **CORRIGÉ**
- Warnings "displayValue vide" et "sousCaracteristiques vide" - **CORRIGÉ** (changés en debug)
- Warnings "terminating connection because of crash" - **CORRIGÉ** (géré dans db_retry.rs)

## Actions Recommandées

### Priorité 1 (Critique)
1. **Corriger tous les composants utilisant `ImagePicker.MediaType` sans protection** (14 fichiers identifiés)
2. **Appliquer la migration `20251127_fix_geo_hierarchy_unique_constraint.sql`**

### Priorité 2 (Important)
3. **Vérifier l'application des index de la migration `20251127_optimize_services_queries_indexes.sql`**
4. **Optimiser davantage la requête SQL dans `get_services_for_prestataire`** (réduire de 2.2s à <1s)

### Priorité 3 (Amélioration)
5. **Améliorer la gestion du pool de connexions** pour éviter les erreurs 500 persistantes
6. **Ajouter un circuit breaker** pour protéger la DB en cas de surcharge

## Fichiers à Corriger

### Mobile (14 fichiers)
1. `mobile/src/components/ChatInputPanel.tsx`
2. `mobile/src/components/ChatModal.tsx`
3. `mobile/src/components/BrandingManagerMobile.tsx`
4. `mobile/src/components/ChaussureVariantManager.tsx`
5. `mobile/src/components/ProductVariantManager.tsx`
6. `mobile/src/components/HotelVariantManager.tsx`
7. `mobile/src/components/PriceVariantSelector.tsx`
8. `mobile/src/components/ChatInputMobile.tsx`
9. `mobile/src/components/ChatModalMobile.tsx`
10. `mobile/src/screens/delivery/CourierRegistrationScreen.tsx`
11. `mobile/src/screens/ProfileScreen.tsx`
12. `mobile/src/screens/CreatePubliciteScreen.tsx`
13. `mobile/src/screens/specialized/CovoiturageFormScreen.tsx`
14. `mobile/src/screens/specialized/TaxiFormScreen.tsx`

### Backend (Vérifications)
1. Vérifier l'application de la migration `backend/migrations/20251127_fix_geo_hierarchy_unique_constraint.sql`
2. Vérifier l'application de la migration `backend/migrations/20251127_optimize_services_queries_indexes.sql`

