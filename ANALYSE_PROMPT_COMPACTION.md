# 🔍 Analyse du Prompt IA pour Compaction

## 📊 Statistiques du Prompt Actuel

**Fichier** : `backend/ia_prompts/creation_service_prompt.md`
- **Lignes totales** : ~1169 lignes
- **Taille estimée** : ~35-40KB
- **Tokens estimés** : ~17 000 tokens (input) + réponse

## 🎯 Analyse des Sections

### ✅ Sections ESSENTIELLES (à conserver intégralement)

1. **Champs obligatoires (lignes 8-46)** : CRITIQUE
   - `titre_service`, `category`, `description`, `is_tarissable`, `type_offre`
   - ⚠️ **Ne pas supprimer** : Instructions critiques pour le frontend

2. **Types de données spécifiques (lignes 48-153)** : CRITIQUE
   - `location`, `date`, `price_variant`, `autocomplete`
   - ⚠️ **Ne pas supprimer** : Détermine le comportement du frontend

3. **Règles d'enrichissement produits (lignes 155-179)** : CRITIQUE
   - Extraction des 6 champs produits
   - ⚠️ **Ne pas supprimer** : Logique métier essentielle

4. **Structure JSON de base (lignes 190-286)** : CRITIQUE
   - Format de réponse attendu
   - ⚠️ **Ne pas supprimer** : Structure de sortie requise

### ⚠️ Sections REDONDANTES (à compacter)

1. **Règles d'enrichissement autocomplete (lignes 518-725)** : REDONDANT
   - Répète les règles déjà expliquées plus haut
   - **Action** : Consolider en une seule section concise
   - **Gain estimé** : ~300 lignes

2. **Exemples détaillés par catégorie (lignes 288-421, 608-671)** : TROP DÉTAILLÉ
   - Exemples répétitifs avec beaucoup de détails
   - **Action** : Réduire à 2-3 exemples génériques
   - **Gain estimé** : ~400 lignes

3. **Formulaires spécialisés (lignes 864-1028)** : OPTIONNEL
   - TICKET_VOYAGE, PHARMACIE, HOPITAL_CLINIQUE, LABORATOIRE
   - **Action** : Garder seulement les champs essentiels, pas les exemples complets
   - **Gain estimé** : ~200 lignes

4. **Champs complémentaires par catégorie (lignes 1091-1163)** : REDONDANT
   - Répète des exemples déjà couverts
   - **Action** : Supprimer ou réduire drastiquement
   - **Gain estimé** : ~150 lignes

5. **Règles répétées (lignes 428-437, 439-493, 1055-1087)** : REDONDANT
   - Les mêmes règles sont répétées plusieurs fois
   - **Action** : Consolider en une seule section
   - **Gain estimé** : ~100 lignes

### ✅ Sections à OPTIMISER (compacter sans perdre)

1. **Exemples autocomplete enrichis (lignes 606-685)** : À COMPACTER
   - Exemples très détaillés pour véhicules, chaussures, smartphones, meubles, prestations
   - **Action** : Réduire à 2 exemples génériques (produit matériel + prestation)
   - **Gain estimé** : ~150 lignes

2. **Checklist finale (lignes 1055-1087)** : À COMPACTER
   - Liste de vérification détaillée
   - **Action** : Réduire à une liste concise en 5 points
   - **Gain estimé** : ~50 lignes

## 📉 Gain Potentiel Total

**Lignes actuelles** : ~1169
**Lignes après compaction** : ~369 (réduction de ~68%)
**Tokens estimés après** : ~5500 tokens (réduction de ~68%)

## 🎯 Plan de Compaction

### Phase 1 : Supprimer les redondances majeures
- ❌ Supprimer exemples détaillés redondants (lignes 288-421)
- ❌ Supprimer formulaires spécialisés détaillés (garder juste les noms de champs)
- ❌ Supprimer champs complémentaires redondants (lignes 1091-1163)

### Phase 2 : Consolider les règles répétées
- ✅ Fusionner sections "RÈGLES D'ENRICHISSEMENT" (3 occurrences → 1)
- ✅ Fusionner sections "RÈGLES ABSOLUES" (3 occurrences → 1)
- ✅ Réduire les exemples autocomplete à 2 exemples génériques

### Phase 3 : Optimiser la structure
- ✅ Réorganiser en sections logiques uniques
- ✅ Supprimer les répétitions de format JSON
- ✅ Simplifier la checklist finale

## ⚠️ Instructions Critiques à PRÉSERVER

1. ✅ Les 5 champs obligatoires (`titre_service`, `category`, `description`, `is_tarissable`, `type_offre`)
2. ✅ Les types de données (`location`, `date`, `price_variant`, `autocomplete`)
3. ✅ Les 6 champs produits obligatoires si produit détecté
4. ✅ Les règles d'enrichissement autocomplete (minimum 8-12 caractéristiques)
5. ✅ Le format JSON strict
6. ✅ Les règles d'extraction de prix (number, jamais string)
7. ✅ Les règles de détection de produits/prestations

## 🔧 Actions Immédiates Recommandées

1. **Créer une version compacte du prompt** en conservant toutes les instructions critiques
2. **Tester avec quelques exemples** pour vérifier que la qualité est maintenue
3. **Mesurer les tokens économisés** après compaction
4. **Monitorer les performances** pour s'assurer que la réduction n'affecte pas la qualité

## 📝 Notes Importantes

- **Ne jamais supprimer** les instructions sur les types de données (location, date, etc.)
- **Ne jamais supprimer** les règles d'enrichissement autocomplete (8-12 caractéristiques)
- **Ne jamais supprimer** les 5 champs obligatoires
- **Garder** au moins 2 exemples génériques (produit matériel + prestation)
- **Simplifier** les exemples plutôt que les supprimer complètement


