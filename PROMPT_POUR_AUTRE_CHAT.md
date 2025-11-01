# PROMPT POUR REFONTE COMPLÈTE - SYSTÈME DE CRÉATION DE PRODUITS YUKPO

## 📋 CONTEXTE DU PROJET

Tu travailles sur une refonte majeure du système de création de produits pour l'application **Yukpo**, une plateforme de services et produits en Afrique francophone.

**Stack technique :**
- **Backend** : Rust avec Axum, SQLx, PostgreSQL, pgvector
- **Frontend Mobile** : React Native avec TypeScript, TailwindCSS
- **IA** : OpenAI GPT-4 pour génération de formulaires dynamiques
- **Base de données** : PostgreSQL avec extensions pgvector et imgsmlr

**Fichiers clés à connaître :**
- `backend/ia_prompts/creation_service_prompt.md` - Prompt pour l'IA externe
- `backend/src/services/creer_service.rs` - Validation et création de services
- `backend/src/schemas/service_schema.json` - Schéma de validation JSON
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` - Écran de création de formulaire
- `mobile/src/utils/formDispatcher.ts` - Interprétation des champs générés par IA
- `mobile/src/components/ProductManagerMobile.tsx` - Ancien gestionnaire de produits (à supprimer)

## 🎯 OBJECTIF PRINCIPAL

Refondre complètement le système de création de produits pour :
1. **Supprimer ProductManagerMobile** et créer un système intégré dans le formulaire
2. **Ajouter caractéristiques autocomplete** avec modalités concaténées et sous-caractéristiques séparées
3. **Ajouter variabilité de prix** pour produits avec variantes (taille, pointure, quantité)
4. **Historiser les caractéristiques** pour réutilisation intelligente dans recherche et filtrage
5. **Contextualiser géographiquement** les suggestions selon la zone de l'utilisateur
6. **Valider et interpréter** les nouveaux types de données côté backend et frontend

## 📝 STRUCTURE DES NOUVELLES DONNÉES

### Caractéristiques Autocomplete
```json
{
  "caracteristiques_autocomplete": {
    "type_donnee": "autocomplete",
    "valeur": ["Toyota,RAV4,2018,4x4", "Toyota,RAV4,2019,4x4"],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Toyota"],
      "modele": ["RAV4", "Corolla"],
      "annee": ["2018", "2019", "2020"]
    },
    "filtrable": true,
    "identifiant_base": "caracteristiques_vehicule",
    "origine_champs": "ia"
  }
}
```

### Variabilité de Prix
```json
{
  "variabilite_prix": {
    "type_donnee": "price_variant",
    "variable": "pointure",
    "filtrable": true,
    "modalites": [
      {"valeur": "38", "prix": 15000, "devise": "XAF", "stock": 5},
      {"valeur": "39", "prix": 15000, "devise": "XAF", "stock": 3}
    ],
    "origine_champs": "ia"
  }
}
```

## 🔧 TÂCHES À RÉALISER

### PHASE 1 : PROMPT IA (CRITIQUE - À FAIRE EN PREMIER)
Le fichier `backend/ia_prompts/creation_service_prompt.md` doit être enrichi avec :
1. Section caractéristiques autocomplete avec exemples
2. Section variabilité de prix
3. Section contextualisation géographique
4. Section interdictions (contenu sexuel, etc.)
5. Sections spécifiques pour formulaires particuliers :
   - `ticket_voyage` : compagnie, départ, destination, date, heure, place, classe
   - `pharmacie` : type, heures ouverture/fermeture, jours, téléphone urgence, services
   - `hopital_clinique` : type établissement, banque de sang, prestations, planning, urgences 24h/24
   - `laboratoire` : type, examens disponibles, planning, prélèvement domicile, résultats rapides

**Référence** : Analyser `mobile/src/components/ProductManagerMobile.tsx` lignes 1654-1666 pour comprendre les configurations spéciales.

### PHASE 2 : VALIDATION SCHÉMA (CRITIQUE - DOIT ÊTRE FAIT TÔT)
1. **Analyser** `backend/src/schemas/service_schema.json` pour comprendre structure actuelle
2. **Ajouter** nouveaux types "autocomplete" et "price_variant" dans le schéma
3. **Mettre à jour** `valider_service_json` dans `backend/src/services/creer_service.rs` pour valider nouveaux types
4. **Tester** validation avec exemples JSON complets

### PHASE 3 : INTERPRÉTATION FRONTEND (CRITIQUE)
1. **Analyser** `mobile/src/utils/formDispatcher.ts` fonction `createFieldComponent`
2. **Ajouter** logique pour interpréter `type_donnee="autocomplete"` → générer `AutocompleteGranularEditor`
3. **Ajouter** logique pour interpréter `type_donnee="price_variant"` → générer `PriceVariantSelector`
4. **Tester** dans `FormulaireYukpoIntelligentScreen` que les nouveaux types s'affichent correctement

### PHASE 4 : BASE DE DONNÉES
Créer migrations SQL pour :
1. Table `autocomplete_characteristics` : historiser les caractéristiques pour autocomplete et filtrage
2. Table `search_history` : historiser les recherches pour suggestions intelligentes

### PHASE 5 : BACKEND SERVICES
1. Créer service Rust `AutocompleteHistoryService` avec méthodes CRUD
2. Créer routes API `/api/autocomplete/*` et `/api/search/history/*`
3. Intégrer historisation automatique lors création de service
4. Améliorer recherche par image (utiliser même logique que création)
5. Enrichir recherche pour inclure TOUS les champs produits (pas seulement généraux)

### PHASE 6 : FRONTEND SERVICES
1. Créer `mobile/src/services/AutocompleteHistoryService.ts`
2. Créer `mobile/src/services/SearchHistoryService.ts`
3. Historiser caractéristiques créées manuellement (pas seulement IA)

### PHASE 7 : COMPOSANTS FRONTEND
1. Créer `AutocompleteGranularEditor.tsx` - édition granulaire des modalités
2. Créer `PriceVariantSelector.tsx` - sélection variantes avec prix
3. Créer `IntelligentSearchBar.tsx` - barre de recherche avec autocomplete historisé

### PHASE 8 : REFONTE FORMULAIRE
Dans `FormulaireYukpoIntelligentScreen.tsx` :
1. **Supprimer** ProductManagerMobile (import ligne 28, bloc lignes 810-832)
2. **Modifier** `processIASuggestion` pour générer champs `produit_*` depuis `suggestion.data.produits[0]`
3. **Modifier** `organizeFieldsIntoBlocks` pour organiser champs `produit_*` dans bloc "Produit"
4. **Modifier** `renderField` pour détecter nouveaux types et rendre composants spécialisés
5. **Implémenter** duplication granulaire avec coût maintenu
6. **Modifier** `soumettreFormulaire` pour reconstruire tableau produits et historiser

### PHASE 9 : RECHERCHE ET FILTRAGE
1. **HomeScreen** : Remplacer ChatInputMobile par IntelligentSearchBar, ajouter scroll produits selon habitudes, scroll automatique publicités
2. **ResultatBesoinScreen** : Corriger crash recherche, remplacer SearchBar, corriger vides à gauche cartes produit, intégrer filtrage autocomplete

### PHASE 10 : GESTION MÉDIAS
1. Supprimer contraintes limites vidéo (cloudUpload.ts ligne 68, CreatePubliciteScreen ligne 183)
2. Positionner image service comme première image produit lors création

## ⚠️ POINTS CRITIQUES À RESPECTER

1. **Historisation manuelle** : Même si produit créé via duplication (pas IA), historiser les caractéristiques avec `origine_champs="utilisateur"`

2. **Coût duplication** : Maintenir `tokens_consumed` du produit original, ne PAS re-appeler IA externe

3. **Médias** : Image transmise lors création service → automatiquement première image du produit

4. **Recherche produits** : Inclure TOUS les champs produits (nom, caracteristiques_autocomplete, etc.), pas seulement champs généraux du service

5. **Recherche image** : Utiliser même logique d'analyse que création pour matching correct

6. **Cartes produit** : Occuper toute largeur écran, pas de vides à gauche (retirer paddingHorizontal/marginHorizontal excessifs)

7. **Validation schéma** : Backend ET frontend doivent valider/interpréter correctement nouveaux types

8. **RÈGLE CRITIQUE - Prix numériques** : TOUS les champs prix doivent être de type `number` (jamais `string`). Valider dans prompt IA, schéma JSON, validation backend et interprétation frontend.

9. **Champs date** : Les champs date doivent utiliser `type_donnee="date"` avec format ISO (YYYY-MM-DD). Le frontend doit générer un DatePicker pour ces champs.

10. **Champs lieux** : Les champs contenant "lieu", "adresse", "localisation", "ville", "quartier" doivent utiliser Google Maps Autocomplete (déjà intégré dans `ModernGPSModal.tsx`). Utiliser `ENVIRONMENT.GOOGLE_MAPS_API_KEY` depuis `config/environment.ts`.

11. **Interprétation React Native** : Le frontend doit pouvoir parser et afficher autocomplete, price_variant, date et location correctement

## 📚 RESSOURCES À CONSULTER

- `TODO_REFONTE_COMPLETE.md` - TODO détaillé avec toutes les tâches
- `mobile/src/components/ProductManagerMobile.tsx` - Configurations spéciales formulaires (lignes 1654-1666)
- `backend/src/services/creer_service.rs` - Validation actuelle (fonction `valider_service_json`)
- `mobile/src/utils/formDispatcher.ts` - Interprétation actuelle des champs

## 🚀 ORDRE DE TRAVAIL RECOMMANDÉ

1. **Phase 1** : Enrichir prompt IA (base de tout)
2. **Phase 8** : Validation schéma (doit être fait tôt pour valider structures)
3. **Phase 3** : Interprétation frontend (pour tester affichage)
4. **Phase 2** : Base de données (structure nécessaire)
5. **Phase 5** : Backend services (API nécessaires)
6. **Phase 6** : Frontend services (services utilisés par composants)
7. **Phase 7** : Composants (composants utilisés par formulaires)
8. **Phase 8** : Refonte formulaire (utilise composants)
9. **Phase 9** : Recherche et filtrage (utilise services et composants)
10. **Phase 10** : Gestion médias (indépendant)

## 💡 NOTES IMPORTANTES

- Le système actuel utilise `ProductManagerMobile` qui doit être complètement supprimé
- Les nouveaux types de données (`autocomplete`, `price_variant`, `date`, `location`) doivent être validés côté backend ET interprétés côté frontend
- **RÈGLE CRITIQUE** : Tous les champs prix doivent être numériques (type `number`), jamais des strings
- Les champs date doivent utiliser `type_donnee="date"` et générer un DatePicker dans le frontend
- Les champs lieux doivent utiliser Google Maps Autocomplete (voir `ModernGPSModal.tsx` lignes 140-199)
- La recherche actuelle ne prend pas en compte les champs produits, seulement les champs généraux du service
- La recherche par image ne fonctionne pas correctement, utiliser même logique que création
- Les cartes produit ont des vides à gauche, corriger les styles pour occuper toute largeur

## 🔧 RESSOURCES GOOGLE MAPS

Le système Google Maps est déjà intégré :
- **Composant** : `mobile/src/components/ModernGPSModal.tsx`
- **API Key** : `mobile/src/config/environment.ts` → `ENVIRONMENT.GOOGLE_MAPS_API_KEY`
- **Fonctionnalités** : Google Places Autocomplete (lignes 140-199), Geocoding, Reverse Geocoding
- **Utilisation** : Réutiliser la logique pour les champs de type lieu dans `formDispatcher.ts`

---

**COMMENCE PAR LA PHASE 1 (Prompt IA) PUIS LA PHASE 8 (Validation Schéma) - CE SONT LES BASES CRITIQUES**

