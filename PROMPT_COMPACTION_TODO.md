# 🎯 TÂCHE : Créer Version Compacte du Prompt IA

## ✅ CE QUI A DÉJÀ ÉTÉ FAIT

1. ✅ **Backup créé** : `backend/ia_prompts/creation_service_prompt.backup.md` (sauvegarde de l'original)
2. ✅ **Analyse complétée** : Document `ANALYSE_PROMPT_COMPACTION.md` créé avec l'analyse détaillée

## 📋 TÂCHE À FAIRE

**Objectif** : Créer une version compacte du prompt en réduisant de ~1169 lignes à ~400-500 lignes (réduction de ~68%) tout en **conservant TOUTES les instructions critiques**.

**Fichier source** : `backend/ia_prompts/creation_service_prompt.backup.md` (1169 lignes)
**Fichier destination** : `backend/ia_prompts/creation_service_prompt.md` (remplacer l'original)

## ⚠️ INSTRUCTIONS CRITIQUES À PRÉSERVER ABSOLUMENT

### 1. Les 5 Champs Obligatoires
- `titre_service` (OBLIGATOIRE)
- `category` (OBLIGATOIRE)
- `description` (OBLIGATOIRE)
- `is_tarissable` (OBLIGATOIRE - boolean)
- `type_offre` (🚨 OBLIGATOIRE - "produit" ou "prestation")

### 2. Types de Données Spécifiques
- `location` : Pour adresses/lieux (Google Maps autocomplete)
- `date` : Format YYYY-MM-DD strict
- `price_variant` : Pour variantes de prix
- `autocomplete` : Pour caractéristiques filtrables (minimum 8-12 caractéristiques)

### 3. Règles d'Extraction Produits (6 Champs)
Si produit/prestation détecté (même UN SEUL), générer TOUJOURS :
1. `produits` avec autocomplete enrichi (8-12 caractéristiques minimum)
2. `nom_produit`
3. `categorie_produit`
4. `description_produit`
5. `prix_produit` (number, jamais string)
6. `devise_produit` (XAF, EUR, USD)

### 4. Règles d'Enrichissement Autocomplete
- **NE JAMAIS se limiter** aux informations explicitement fournies
- **AJOUTER TOUJOURS** des caractéristiques standards même si non mentionnées
- **MINIMUM 8-12 caractéristiques** pour produits complexes
- **MINIMUM 6-8 caractéristiques** pour produits simples
- **Listes complètes** de valeurs possibles pour chaque caractéristique

### 5. Règles de Prix
- **Prix = number** (jamais string)
- Extraire EXACTEMENT les prix visibles dans l'image/texte
- Si prix non identifié → null pour `prix_produit`, 0 pour `variabilite_prix.modalites`

## ❌ SECTIONS À SUPPRIMER/RÉDUIRE

### 1. Supprimer les Redondances Majeures
- ❌ Section "📋 EXEMPLES DE CHAMPS ADDITIONNELS PAR CATÉGORIE" (lignes 288-421) - Trop détaillée, garder juste 2-3 exemples génériques
- ❌ Section "⚠️ 🚨 RÈGLE ABSOLUE - 5 CHAMPS OBLIGATOIRES" (lignes 439-468) - Déjà expliqué plus haut
- ❌ Section "EXTRACTION STRICTE DES PRODUITS" (lignes 483-508) - Redondante avec section lignes 157-178
- ❌ Section "📦 CHAMPS COMPLÉMENTAIRES ENRICHIS PAR CATÉGORIE" (lignes 1091-1163) - Trop détaillée, garder juste une note

### 2. Consolider les Règles Répétées
- ✅ Fusionner les 3 sections "RÈGLES D'ENRICHISSEMENT" en UNE seule section concise
- ✅ Fusionner les règles autocomplete répétées (lignes 565-725) en UNE section concise avec 2 exemples génériques seulement

### 3. Réduire les Exemples Détaillés
- ✅ Réduire les exemples autocomplete enrichis (lignes 606-684) à **2 exemples génériques** :
  - 1 exemple produit matériel (véhicule ou smartphone)
  - 1 exemple prestation (cours/formation)
- ✅ Supprimer les exemples redondants par catégorie

### 4. Simplifier les Formulaires Spécialisés
- ✅ Garder seulement les noms de champs pour TICKET_VOYAGE, PHARMACIE, HOPITAL_CLINIQUE, LABORATOIRE (pas les exemples JSON complets)
- ✅ Juste une liste des champs requis, pas les structures complètes

## ✅ STRUCTURE PROPOSÉE DE LA VERSION COMPACTE

```
1. Introduction (lignes 1-6) - GARDER
2. ⚠️ CHAMPS OBLIGATOIRES (lignes 8-46) - GARDER INTÉGRALEMENT
3. 🎯 TYPES DE DONNÉES (lignes 48-153) - GARDER INTÉGRALEMENT
4. RÈGLES D'ENRICHISSEMENT (lignes 155-185) - CONSOLIDER en 1 section
5. Format de réponse attendu (lignes 190-286) - GARDER, simplifier légèrement
6. Exemples génériques (2-3 exemples max) - RÉDUIRE DRASTIQUEMENT
7. Règles autocomplete enrichies - CONSOLIDER en 1 section avec 2 exemples
8. Variabilité prix - GARDER mais simplifier
9. Formulaires spécialisés - JUSTE les noms de champs requis
10. Checklist finale - SIMPLIFIER à 5 points essentiels
11. Interdictions - GARDER (court)
```

## 📝 COMMANDES À EXÉCUTER

```powershell
# 1. Vérifier que le backup existe
cd backend/ia_prompts
ls creation_service_prompt*.md

# 2. Lire le backup pour référence
Get-Content creation_service_prompt.backup.md | Measure-Object -Line

# 3. Créer la version compacte (remplacer le fichier original)
# ... utiliser l'outil write pour créer la version compacte ...
```

## 🎯 RÉSULTAT ATTENDU

- **Lignes** : ~400-500 lignes (au lieu de 1169)
- **Tokens** : ~5500 tokens (au lieu de ~17000)
- **Réduction** : ~68%
- **Instructions** : 100% conservées (toutes les règles critiques présentes)

## ⚠️ CHECKLIST AVANT VALIDATION

Avant de valider la version compacte, vérifier que :

- ✅ Les 5 champs obligatoires sont bien expliqués
- ✅ Les types de données (location, date, price_variant, autocomplete) sont bien documentés
- ✅ Les règles d'enrichissement autocomplete (8-12 caractéristiques) sont claires
- ✅ Les 6 champs produits sont bien expliqués
- ✅ Les règles de prix (number, jamais string) sont présentes
- ✅ Le format JSON de réponse est fourni
- ✅ Au moins 2 exemples génériques sont présents (produit + prestation)
- ✅ La checklist finale est présente (même simplifiée)

## 📚 FICHIERS DE RÉFÉRENCE

- **Backup original** : `backend/ia_prompts/creation_service_prompt.backup.md`
- **Analyse détaillée** : `ANALYSE_PROMPT_COMPACTION.md`
- **Document actuel** : `backend/ia_prompts/creation_service_prompt.md` (à remplacer)

## 🚀 ÉTAPES RECOMMANDÉES

1. Lire le backup complet pour comprendre toute la structure
2. Créer la version compacte section par section
3. Vérifier que toutes les instructions critiques sont présentes
4. Comparer avec le backup pour s'assurer qu'aucune règle critique n'a été oubliée
5. Tester mentalement avec quelques exemples (véhicule, cours, produit simple)

---

**Note importante** : Même si la version est compacte, elle DOIT rester aussi complète en termes d'instructions. La compaction vient de la suppression des redondances et des exemples répétitifs, PAS de la suppression de règles importantes.




