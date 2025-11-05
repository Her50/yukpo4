# Guide de redéploiement backend - 2025-11-05

## ⚠️ IMPORTANT : Aucune correction n'est active pour le moment

**Les logs montrent que le backend tourne ENCORE avec l'ancienne version** (avant corrections).

**Erreurs actuelles en production** :
```
❌ column "operation_type" violates not-null constraint
❌ column ac.product_labels does not exist  
❌ function extract_all_product_text(jsonb) does not exist
```

---

## ✅ Corrections appliquées dans le code (backend/src/migrations/auto_migrate.rs)

### 1. Nouvelles colonnes ajoutées

#### `autocomplete_combinations`
- ✅ `product_labels TEXT[]`
- ✅ `location_labels TEXT[]`
- ✅ `session_id TEXT`
- ✅ Fonction `upsert_autocomplete_combination(16 paramètres)`

#### `autocomplete_characteristics`
- ✅ `characteristic_vector TEXT[]`
- ✅ `location_vector TEXT[]`
- ✅ `full_vector TEXT[]`
- ✅ `product_id TEXT`
- ✅ `chosen_location_geoname_id BIGINT`
- ✅ `is_real_product BOOLEAN`
- ✅ **`product_labels TEXT[]`** ⭐ NOUVEAU 2025-11-05

#### `token_usage_logs`
- ✅ `intention VARCHAR(100)`
- ✅ `tokens_ia_consumed INTEGER`
- ✅ `tokens_cost_xaf NUMERIC(15, 2)`
- ✅ `tokens_deducted INTEGER`
- ✅ `balance_before INTEGER`
- ✅ `balance_after INTEGER`
- ✅ `processing_time_ms INTEGER`
- ✅ `response_source VARCHAR(50)`
- ✅ `endpoint TEXT`
- ✅ **`operation_type VARCHAR(50)`** ⭐ NOUVEAU 2025-11-05

### 2. Nouvelles fonctions SQL

- ✅ **`extract_all_product_text(JSONB)`** ⭐ NOUVEAU 2025-11-05
- ✅ `upsert_autocomplete_combination(...)` (mise à jour)

### 3. Autres tables protégées (bug silencieux)

- ✅ `publicites` (4 colonnes vérifiées)
- ✅ `notifications` (4 colonnes vérifiées)
- ✅ `service_reviews` (2 colonnes vérifiées)
- ✅ `product_reactions` (2 colonnes vérifiées)
- ✅ `products_lifecycle` (2 colonnes vérifiées)

**Total** : **33 colonnes** + **2 fonctions SQL** protégées

---

## 🚀 Comment appliquer les corrections ?

### Option 1 : Redémarrage sur Render (RECOMMANDÉ)

**Étapes** :

1. **Pusher le code sur Git** :
```bash
cd c:\Users\23767\yukpomnang2
git add backend/src/migrations/auto_migrate.rs
git commit -m "fix: Corriger bug silencieux migrations auto (33 colonnes + 2 fonctions)"
git push origin master
```

2. **Redémarrer le backend sur Render** :
   - Aller sur https://dashboard.render.com
   - Sélectionner le service `yukpomnang-backend`
   - Cliquer sur "Manual Deploy" → "Deploy latest commit"
   - OU attendre le déploiement automatique (si activé)

3. **Vérifier les logs de démarrage** :
```
🚀 Démarrage des migrations automatiques...
✅ Migration auto: extract_all_product_text OK
⚠️  Colonne product_labels manquante dans autocomplete_characteristics, ajout en cours...
✅ Colonne product_labels ajoutée à autocomplete_characteristics
⚠️  Colonne session_id manquante, ajout en cours...
✅ Colonne session_id ajoutée
⚠️  Colonne operation_type manquante, ajout en cours...
✅ Colonne operation_type ajoutée
✅ Migrations automatiques terminées
```

### Option 2 : Redémarrage local (pour tests)

**Prérequis** : PostgreSQL local avec base `yukpomnang`

```bash
cd backend

# Définir DATABASE_URL
$env:DATABASE_URL="postgresql://postgres:password@localhost/yukpomnang"

# Lancer le backend
cargo run

# Observer les logs :
# 🚀 Démarrage des migrations automatiques...
# ✅ Migration auto: extract_all_product_text OK
# ⚠️  Colonne product_labels manquante...
# ✅ Colonne product_labels ajoutée
# ...
# ✅ Migrations automatiques terminées
# 🎯 Serveur lancé sur http://0.0.0.0:3001
```

---

## 📊 Validation post-déploiement

### Tests à effectuer après redémarrage

#### 1. Créer un nouveau service avec l'IA

**Mobile** : 
- Aller dans l'app → "Créer un service"
- Dire "Vente de chaussures Nike"
- Vérifier que les champs produits se remplissent automatiquement

**Logs attendus** :
```
✅ [AutocompleteCombinations] ✅ 4 combinaisons sauvegardées sur 4
✅ [Background] ✅ 108 combinaisons sauvegardées avec succès
✅ [check_tokens] ✅ Historique de tokens enregistré
```

**Au lieu de** :
```
❌ column "session_id" does not exist
❌ function upsert_autocomplete_combination(...) does not exist
❌ column "operation_type" violates not-null constraint
```

#### 2. Tester la recherche dans ResultatBesoinScreen

**Mobile** :
- Aller dans "Rechercher"
- Taper "Plombier"
- La barre de recherche ne doit PAS crasher

#### 3. Tester le champ caractéristiques produit

**Mobile** :
- Créer un service → Bloc "Produits"
- Le champ "Caractéristiques produit" ne doit PAS crasher
- Placeholder doit afficher l'exemple IA

#### 4. Tester le champ lieu commercial

**Mobile** :
- Dans le formulaire → "Lieu de commercialisation"
- Chercher "Douala" → ✅ Trouve
- Chercher "Bonanjo" → ✅ Trouve (quartier)
- Chercher "Cameroun" → ✅ Trouve (pays)

---

## 🎯 Indicateurs de succès

| Métrique | Avant | Après (attendu) |
|----------|-------|-----------------|
| **Combinaisons sauvegardées** | 0/108 (0%) | 108/108 (100%) |
| **Historique tokens** | ❌ Erreur | ✅ Enregistré |
| **Crash LinearAutocompleteEditor** | ❌ Oui | ✅ Non |
| **Crash ResultatBesoinScreen** | ❌ Oui | ✅ Non |
| **Champs produits vides** | ❌ Oui | ✅ Remplis |
| **Recherche lieu limitée** | ❌ Ville seule | ✅ Ville+Quartier+Pays |

---

## 🔧 En cas de problème après redémarrage

### Si les erreurs persistent

1. **Vérifier que le code a bien été déployé** :
   - Les logs de démarrage doivent montrer "Migration auto: extract_all_product_text OK"
   - Si absent → Le code n'est pas à jour sur le serveur

2. **Vérifier que les migrations se sont exécutées** :
   - Les logs doivent montrer "✅ Colonne XXX ajoutée"
   - Si absent → Problème avec auto_migrate.rs

3. **Vérifier la base de données manuellement** :
```sql
-- Vérifier colonnes dans autocomplete_combinations
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'autocomplete_combinations';

-- Vérifier colonnes dans token_usage_logs
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'token_usage_logs';

-- Vérifier fonction extract_all_product_text
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'extract_all_product_text';
```

---

## 📋 Checklist de déploiement

- [ ] Code pushé sur Git (branch `master`)
- [ ] Backend redémarré sur Render
- [ ] Logs de migrations vérifiés (✅ colonnes ajoutées)
- [ ] Test création service (champs produits remplis)
- [ ] Test barre de recherche (pas de crash)
- [ ] Test champ caractéristiques (pas de crash)
- [ ] Test lieu commercial (ville + quartier + pays)
- [ ] Vérifier logs backend (plus d'erreurs "column does not exist")

---

## 🎯 Pourquoi les corrections n'étaient pas actives ?

**L'auto-migration s'exécute UNIQUEMENT au démarrage du backend** (main.rs ligne 38) :

```rust
// 🔄 Exécuter les migrations automatiques au démarrage
yukpomnang_backend::migrations::auto_migrate::run_auto_migrations(&pg_pool).await;
```

**Si le backend n'est pas redémarré** → Les corrections dans `auto_migrate.rs` restent dans le code **SANS être exécutées** !

**Solution** : **REDÉMARRER LE BACKEND** pour que les migrations auto s'appliquent.

---

**Date** : 2025-11-05  
**Statut** : ⏳ EN ATTENTE DE REDÉMARRAGE  
**Action requise** : Push Git + Redémarrage Render

