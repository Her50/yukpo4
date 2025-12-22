# Corrections - Création Produit & Configuration Livraison

## 📋 Problèmes identifiés

### 1. Création de produit très lente (32 secondes)
- **IA externe** : 15 secondes (normal, API externe)
- **REFRESH MATERIALIZED VIEW** : 7-11 secondes (bloquant)
- **UPDATE services** : 5-7 secondes (connexions DB instables sur Render)
- **save_autocomplete_combination** : Déjà en arrière-plan (OK)

### 2. Formulaire de configuration livraison
- **Plages horaires** : Affichage JSON brut au lieu d'un formulaire structuré
- **Modes de livraison** : Liste vide car `parcel_types` ne correspond pas aux types de véhicules des coursiers

---

## ✅ Corrections apportées

### 1. Migration : Aligner parcel_types avec les types de véhicules
**Fichier** : `backend/migrations/20251221_align_parcel_types_with_vehicle_types.sql`

- Supprime les anciens `parcel_types` qui ne correspondent pas
- Insère 8 types alignés avec `delivery_engine_type` :
  - `bike` (Vélo)
  - `motorcycle` (Moto)
  - `tricycle` (Tricycle)
  - `car` (Voiture)
  - `pickup` (Pick-up)
  - `van` (Camionnette)
  - `truck` (Camion)
  - `walking` (À pied)

**À exécuter** :
```bash
sqlx migrate run
```

### 2. Composant TimeSlotPicker pour les plages horaires
**Fichier** : `mobile/src/components/delivery/TimeSlotPicker.tsx`

- Remplace le `TextInput` avec JSON brut
- Interface graphique avec :
  - Sélection par jour de la semaine
  - Ajout/suppression de plages horaires
  - Sélection d'heures de début/fin
  - Validation automatique du format JSON

**Intégration** : Déjà intégré dans `ProductDeliveryConfigModal.tsx`

### 3. Optimisations performance (recommandations)

#### A. REFRESH MATERIALIZED VIEW
**Problème** : Les REFRESH prennent 7-11s et bloquent les connexions DB

**Solutions** :
1. **Augmenter l'intervalle** (déjà fait dans `search_cache_refresh.rs` : 2 min → 5 min)
2. **Utiliser pool séparé** (déjà fait : `pool_long_operations`)
3. **Mutex global** (déjà fait : évite REFRESH simultanés)

**Recommandation supplémentaire** : Désactiver les REFRESH automatiques pendant les heures de pointe ou utiliser un système de queue

#### B. UPDATE services (5-7s)
**Problème** : Connexions DB instables sur Render (crashes fréquents)

**Solutions déjà en place** :
- Retry automatique avec `db_retry::retry_query` (5 tentatives max)
- Pool de connexions avec timeout

**Recommandation** : Monitorer les connexions DB et considérer un upgrade du plan Render

#### C. IA externe (15s)
**Normal** : API externe, pas d'optimisation possible côté backend

**Recommandation** : Afficher un indicateur de progression côté mobile pendant l'appel IA

---

## 🚀 Déploiement

### 1. Appliquer la migration
```bash
cd backend
sqlx migrate run
```

### 2. Vérifier les parcel_types
```sql
SELECT id, slug, display_name FROM parcel_types ORDER BY slug;
```

### 3. Tester le formulaire mobile
- Ouvrir la configuration de livraison d'un produit
- Vérifier que la liste des types de véhicules est remplie
- Tester le composant TimeSlotPicker

---

## 📊 Résultats attendus

### Avant
- ❌ Liste modes de livraison vide
- ❌ JSON brut pour plages horaires
- ❌ Création produit : 32s (15s IA + 17s DB/REFRESH)

### Après
- ✅ Liste modes de livraison complète (8 types)
- ✅ Formulaire structuré pour plages horaires
- ✅ Création produit : ~15-20s (15s IA + 5s DB, REFRESH en arrière-plan)

---

## 🔍 Monitoring

### Logs à surveiller
```bash
# Vérifier les REFRESH MATERIALIZED VIEW
grep "REFRESH MATERIALIZED VIEW" logs/*.log

# Vérifier les UPDATE services lents
grep "slow statement.*UPDATE services" logs/*.log

# Vérifier les connexions DB qui crash
grep "terminating connection because of crash" logs/*.log
```

### Métriques
- Temps moyen création produit : **< 20s** (objectif)
- Temps REFRESH MATERIALIZED VIEW : **< 10s** (acceptable)
- Taux d'erreur connexion DB : **< 1%** (objectif)

---

## 📝 Notes

1. **REFRESH MATERIALIZED VIEW** : Les vues matérialisées sont rafraîchies automatiquement toutes les 5 minutes. Pendant la création de produit, le REFRESH peut se déclencher en parallèle, ce qui peut ralentir la réponse.

2. **Connexions DB Render** : Les crashes de connexion sont fréquents sur le plan gratuit/standard de Render. Un upgrade peut être nécessaire si le problème persiste.

3. **IA externe** : Le temps de réponse de 15s est normal pour une API externe. Pas d'optimisation possible côté backend.

---

## ✅ Checklist de validation

- [ ] Migration appliquée (`parcel_types` alignés)
- [ ] Liste modes de livraison remplie dans le formulaire mobile
- [ ] TimeSlotPicker fonctionne correctement
- [ ] Création produit < 20s (hors IA)
- [ ] Pas d'erreurs dans les logs après déploiement


