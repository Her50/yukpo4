# 🔍 Analyse du Prompt de Création de Service - Nom du Prestataire

## ✅ Problème résolu

Le prompt de création de service **ne mentionnait pas explicitement** le champ `nom_prestataire` ou `prestataire_nom`, ce qui pouvait affecter le matching Google Places. **Ce problème a été corrigé** en ajoutant explicitement ce champ dans les prompts.

## 📋 État actuel du prompt

### Dans `backend/ia_prompts/creation_service_prompt.md`

**Ligne 37** mentionne :
```
**Titre du service** : Si le contexte révèle un nom de boutique/structure, utilise-le tel quel. 
Sinon, construis un titre descriptif basé sur produit/prestation + localisation.
```

**Problème** :
- ✅ Le nom de boutique/structure est utilisé dans `titre_service`
- ❌ Mais il n'y a **pas de champ dédié** `nom_prestataire` ou `prestataire_nom`
- ❌ Le nom du prestataire peut être perdu ou mélangé avec le titre du service

### Dans `backend/src/services/ia/prompts/creation_service.md`

**Aucune mention** de `nom_prestataire` ou `prestataire_nom`.

## 🎯 Impact sur le matching Google Places

### Comment le nom est actuellement utilisé

1. **Extraction dans `enrich_service_with_google()`** :
   ```rust
   // backend/src/services/creer_service.rs ligne ~419-420
   let nom_prestataire = extract_string_field(map, "nom_prestataire")
       .or_else(|| extract_string_field(map, "prestataire_nom"));
   ```

2. **Fallback depuis `users`** :
   ```rust
   // Si pas trouvé dans JSON, récupérer depuis users
   if nom_prestataire.is_none() {
       SELECT COALESCE(nom_complet, CONCAT(prenom, ' ', nom)) FROM users
   }
   ```

3. **Utilisation pour matching** :
   - Construction de la requête Google Places : `"Restaurant Chez Marie Douala"`
   - Validation du matching : Vérifier si `display_name` contient le nom

### Problème actuel

- ❌ Si l'IA ne génère pas `nom_prestataire` dans le JSON → Fallback vers `users.nom_complet`
- ❌ Mais `users.nom_complet` peut être le nom de l'utilisateur (ex: "Jean Dupont") et non le nom commercial (ex: "Restaurant Chez Marie")
- ❌ Le matching Google Places peut être moins précis

## ✅ Solution proposée

### 1. Ajouter `nom_prestataire` dans le prompt

**Dans `backend/ia_prompts/creation_service_prompt.md`** :

Ajouter une section après `titre_service` :

```markdown
## CHAMP NOM PRESTATAIRE (OBLIGATOIRE pour matching Google Places)

**OBLIGATOIRE** : Extraire le nom du prestataire/commerce/établissement si mentionné dans l'input.

```json
{
  "nom_prestataire": {
    "type_donnee": "string",
    "valeur": "[Nom du commerce/établissement/prestataire]",
    "origine_champs": "ia"
  }
}
```

**Règles d'extraction** :
1. **Si nom de boutique/structure mentionné** : Utiliser ce nom exactement
   - Exemple : "Restaurant Chez Marie" → `"valeur": "Restaurant Chez Marie"`
   - Exemple : "Boutique CM" → `"valeur": "Boutique CM"`

2. **Si pas de nom explicite** : Laisser vide ou utiliser `null`
   - Le système utilisera automatiquement `users.nom_complet` comme fallback

3. **Différence avec `titre_service`** :
   - `titre_service` : Titre descriptif du service (ex: "Vente de vêtements à Douala")
   - `nom_prestataire` : Nom commercial/établissement (ex: "Boutique CM")

**Exemples** :
- Input : "Je vends des vêtements dans ma boutique CM à Douala"
  - `titre_service` : "Vente de vêtements à Douala"
  - `nom_prestataire` : "Boutique CM"

- Input : "Restaurant Chez Marie, spécialisé en cuisine camerounaise"
  - `titre_service` : "Restaurant spécialisé en cuisine camerounaise"
  - `nom_prestataire` : "Restaurant Chez Marie"

- Input : "Je propose des cours d'anglais"
  - `titre_service` : "Cours d'anglais"
  - `nom_prestataire` : `null` (pas de nom commercial mentionné)
```

### 2. Ajouter dans la structure finale

**Dans la section "STRUCTURE FINALE"** :

```json
{
  "intention": "creation_service",
  "data": {
    "titre_service": {...},
    "category": {...},
    "description": {...},
    "nom_prestataire": {
      "type_donnee": "string",
      "valeur": "[Nom du commerce/établissement] ou null",
      "origine_champs": "ia"
    },
    "is_tarissable": {...},
    "type_offre": {...},
    // ... autres champs
  }
}
```

### 3. Mettre à jour le prompt minimal

**Dans `backend/src/services/ia/prompts/creation_service.md`** :

Ajouter après `titre_service` :

```markdown
**nom_prestataire** (OPTIONNEL mais recommandé) :
- Nom du commerce/établissement/prestataire si mentionné dans l'input
- Utilisé pour améliorer le matching Google Places
- Si non mentionné, peut être omis (fallback automatique vers users.nom_complet)
```

## 📊 Comparaison avant/après

### Avant
```
Input : "Je vends des vêtements dans ma boutique CM à Douala"

JSON généré :
{
  "titre_service": "Vente de vêtements à Douala",
  // ❌ Pas de nom_prestataire
}

Matching Google Places :
- Requête : "Vente de vêtements à Douala" (sans nom commercial)
- Fallback : users.nom_complet = "Jean Dupont" (nom personnel, pas commercial)
- ❌ Matching moins précis
```

### Après
```
Input : "Je vends des vêtements dans ma boutique CM à Douala"

JSON généré :
{
  "titre_service": "Vente de vêtements à Douala",
  "nom_prestataire": {
    "type_donnee": "string",
    "valeur": "Boutique CM",
    "origine_champs": "ia"
  }
}

Matching Google Places :
- Requête : "Vente de vêtements Boutique CM Douala"
- Validation : Vérifie si display_name contient "Boutique CM"
- ✅ Matching plus précis
```

## ✅ Modifications apportées

1. ✅ **Ajouté `nom_prestataire` dans le prompt principal** (`creation_service_prompt.md`)
   - Section explicative après `titre_service`
   - Exemples concrets d'extraction
   - Clarification de la différence avec `titre_service`
   - Ajout dans la structure JSON de l'étape 2

2. ✅ **Ajouté dans le prompt minimal** (`backend/src/services/ia/prompts/creation_service.md`)
   - Champ `nom_prestataire` dans la structure obligatoire
   - Note explicative sur l'utilisation et le fallback

3. ✅ **Clarifié la différence** entre `titre_service` et `nom_prestataire`
   - `titre_service` : Titre descriptif du service
   - `nom_prestataire` : Nom commercial/établissement

4. ✅ **Ajouté des exemples concrets** d'extraction du nom commercial

## ✅ Avantages

1. **Matching Google Places plus précis** : Le nom commercial est utilisé pour valider les résultats
2. **Meilleure identification** : Distinction claire entre titre descriptif et nom commercial
3. **Fallback robuste** : Si non mentionné, utilisation automatique de `users.nom_complet`
4. **Cohérence** : Le champ est explicitement demandé dans le prompt

