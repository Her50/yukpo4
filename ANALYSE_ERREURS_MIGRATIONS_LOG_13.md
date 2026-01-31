# Analyse des Erreurs de Migration - Log (13)

**Date d'analyse** : 2026-01-31  
**Fichier analysé** : `log-events-viewer-result (13).csv`

## 📊 Résumé Global

- **Total d'erreurs identifiées** : **95 erreurs**
- **Types d'erreurs principaux** :
  1. Erreurs de syntaxe (fragments de commandes) : ~70 erreurs
  2. Commandes multiples non divisées : ~5 erreurs
  3. Fonctions manquantes : 4 erreurs
  4. Triggers déjà existants : 1 erreur
  5. Fonctions sans LANGUAGE : 2 erreurs

---

## 🔴 Erreurs par Type

### 1. Erreurs de Syntaxe - Fragments de Commandes (~70 erreurs)

Ces erreurs sont causées par des fragments de commandes SQL qui sont exécutés comme des commandes complètes :

#### Fragments commençant par "id" (~25 erreurs)
- `syntax error at or near "id" at character 1`
- **Cause** : Fragments de CREATE TABLE coupés (ex: `id SERIAL PRIMARY KEY,`)
- **Exemples** :
  - Ligne 5108 : `id UUID PRIMARY KEY DEFAULT gen_random_uuid(),` (fragment de table `duets`)
  - Ligne 9 : `id SERIAL PRIMARY KEY,` (fragment de table `family_profiles`)

#### Fragments commençant par "p_service_id" (~8 erreurs)
- `syntax error at or near "p_service_id" at character 1`
- **Cause** : Fragments de fonctions CREATE FUNCTION coupées
- **Exemples** :
  - Ligne 5126 : `p_service_id INTEGER,` (fragment de fonction)

#### Fragments commençant par "u." ou "ON" (~10 erreurs)
- `syntax error at or near "u" at character 1`
- `syntax error at or near "ON" at character 1`
- **Cause** : Fragments de CREATE INDEX ou SELECT coupés
- **Exemples** :
  - Ligne 5113 : `u.id,` (fragment de SELECT)
  - Ligne 5123 : `ON services (user_id, created_at DESC)` (fragment de CREATE INDEX)

#### Fragments commençant par "RETURNS" (~4 erreurs)
- `syntax error at or near "RETURNS" at character 1`
- **Cause** : Fonctions CREATE FUNCTION coupées après le point-virgule
- **Exemples** :
  - Ligne 5091 : `CREATE OR REPLACE FUNCTION run_audio_cache_cleanup();` puis `RETURNS TABLE(` séparés

#### Fragments avec erreurs de point-virgule (~15 erreurs)
- `syntax error at or near ";" at character X`
- **Cause** : Commandes mal formées avec point-virgule mal placé

---

### 2. Commandes Multiples Non Divisées (~5 erreurs)

- `cannot insert multiple commands into a prepared statement`
- **Cause** : Plusieurs commandes SQL dans un même bloc non divisées
- **Exemples** :
  - Ligne 2 : 4 CREATE INDEX sur `delivery_partners` dans un même bloc
  - Ligne 5093 : DROP TRIGGER + CREATE TRIGGER dans un même bloc
  - Ligne 5100 : DROP TRIGGER + CREATE TRIGGER dans un même bloc

---

### 3. Fonctions Manquantes (4 erreurs)

- `function run_audio_cache_cleanup() does not exist`
- **Occurrences** : 4 fois (lignes 23, 27, 6598, 6602)
- **Cause** : La fonction `run_audio_cache_cleanup()` est appelée avant d'être créée, ou sa création a échoué

---

### 4. Triggers Déjà Existants (1 erreur)

- `trigger "trigger_update_templates_updated_at" for relation "video_templates" already exists`
- **Ligne** : 31
- **Cause** : Le trigger existe déjà, mais le DROP IF EXISTS n'a pas été exécuté avant le CREATE

---

### 5. Fonctions Sans LANGUAGE (2 erreurs)

- `no language specified`
- **Occurrences** : 2 fois (lignes 5458, 5496)
- **Cause** : Fonctions CREATE FUNCTION créées sans clause LANGUAGE plpgsql

---

## 📋 Tables Potentiellement Non Migrées

### Tables avec Erreurs de Migration

1. **`delivery_partners`**
   - **Erreur** : Index non créés (commande multiple non divisée)
   - **Ligne** : 2-7
   - **Statut** : ⚠️ Index manquants

2. **`family_profiles`**
   - **Erreur** : Fragment de CREATE TABLE exécuté (`id SERIAL PRIMARY KEY,`)
   - **Ligne** : 9-22
   - **Statut** : ❌ Table probablement non créée complètement

3. **`duets`** (table sociale vidéo)
   - **Erreur** : Fragment de CREATE TABLE exécuté (`id UUID PRIMARY KEY...`)
   - **Ligne** : 5108-5112
   - **Statut** : ❌ Table probablement non créée

4. **`deliveries`**
   - **Erreur** : Trigger non créé (commande multiple non divisée)
   - **Ligne** : 5093-5099
   - **Statut** : ⚠️ Trigger manquant

5. **`delivery_media`**
   - **Erreur** : Trigger non créé (commande multiple non divisée)
   - **Ligne** : 5100-5106
   - **Statut** : ⚠️ Trigger manquant

### Tables avec Index Manquants

- Index sur `services` (ligne 5123) : `ON services (user_id, created_at DESC)`
- Plusieurs index sur des tables non identifiées (fragments)

---

## 🔧 Fonctions Non Créées

1. **`run_audio_cache_cleanup()`**
   - **Erreur** : Fonction appelée mais n'existe pas
   - **Occurrences** : 4 fois
   - **Statut** : ❌ Fonction manquante

2. **Fonctions avec fragments** :
   - Fonctions commençant par `p_service_id INTEGER,` (plusieurs occurrences)
   - Fonction `run_audio_cache_cleanup()` coupée (ligne 5091-5092)

---

## ✅ Corrections Appliquées

Les corrections suivantes ont été appliquées dans `auto_migrate.rs` :

1. ✅ **Validation des fragments** : Rejet des commandes qui ne commencent pas par un mot-clé SQL valide
2. ✅ **Amélioration division** : Meilleure détection et division des commandes multiples
3. ✅ **Protection fonctions** : Évite de diviser incorrectement les fonctions CREATE FUNCTION

---

## 📝 Recommandations

1. **Vérifier l'existence des tables** :
   - `family_profiles`
   - `delivery_partners`
   - `duets`
   - Tables sociales vidéo (remixes, stitches, etc.)

2. **Vérifier les fonctions** :
   - `run_audio_cache_cleanup()` - Créer si manquante
   - Fonctions avec paramètres `p_service_id` - Vérifier leur création complète

3. **Vérifier les triggers** :
   - `trigger_check_round_trip_consistency` sur `deliveries`
   - `trigger_update_delivery_media_updated_at` sur `delivery_media`
   - `trigger_update_templates_updated_at` sur `video_templates`

4. **Vérifier les index** :
   - Index sur `delivery_partners` (4 index)
   - Index sur `services` (user_id, created_at DESC)

---

## 🎯 Prochaines Étapes

1. Exécuter un script de vérification pour identifier les tables/fonctions/triggers manquants
2. Créer manuellement les objets manquants si nécessaire
3. Réexécuter les migrations avec les corrections appliquées
4. Vérifier que toutes les tables sont créées correctement

