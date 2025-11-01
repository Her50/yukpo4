# TODO - Refonte Complète du Système de Création de Produits

## 📋 PHASE 1 : PROMPT IA - ENRICHISSEMENT COMPLET

### 1.1 Caractéristiques Autocomplete
- [ ] **prompt_1**: Enrichir le prompt avec section caractéristiques autocomplete
  - Expliquer structure modalités concaténées séparées par virgules
  - Sous-caractéristiques séparées pour recherche PostgreSQL
  - identifiant_base, filtrable, separateur
  - Minimum 8-10 modalités par défaut

- [ ] **prompt_2**: Ajouter section variabilité de prix
  - Expliquer price_variant avec variable, modalités avec prix
  - Champ filtrable pour filtres dans ResultatBesoinScreen

- [ ] **prompt_3**: Ajouter section contextualisation géographique
  - Adapter suggestions selon zone GPS/ville
  - Éviter produits non disponibles localement
  - Exemples concrets par zone (Douala, Yaoundé, etc.)

- [ ] **prompt_4**: Ajouter section interdictions absolues
  - Contenu sexuel, prostitution, armes, substances illégales
  - Retourner JSON erreur structuré si détecté

- [ ] **prompt_5**: Ajouter exemples concrets pour 5 catégories
  - Automobile, chaussure, aliment, vêtement, immobilier
  - Structure complète avec autocomplete + variabilité prix

- [ ] **prompt_6_rules**: Ajouter règles strictes pour types de données
  - TOUS les champs prix doivent être de type number (jamais string)
  - Champs date doivent utiliser type_donnee="date" avec format ISO (YYYY-MM-DD)
  - Champs lieux doivent utiliser type_donnee="location" pour déclencher Google Maps

### 1.2 Formulaires Particuliers (ProductManagerMobile)
- [ ] **prompt_6**: Analyser configuration ticket_voyage dans ProductManagerMobile
  - Extraire champs spéciaux (compagnie, départ, destination, date, heure, place, classe, etc.)
  - Ajouter règles spécifiques dans prompt pour génération IA

- [ ] **prompt_7**: Analyser configuration pharmacie dans ProductManagerMobile
  - Extraire champs spéciaux (type, heures ouverture/fermeture, jours, téléphone urgence, services)
  - Ajouter règles spécifiques pour pharmacie de garde vs normale

- [ ] **prompt_8**: Analyser configuration hopital_clinique dans ProductManagerMobile
  - Extraire champs spéciaux (type établissement, banque de sang, prestations médicales, planning, urgences 24h/24, RDV en ligne)
  - Ajouter règles spécifiques pour hôpital vs clinique

- [ ] **prompt_9**: Analyser configuration laboratoire dans ProductManagerMobile
  - Extraire champs spéciaux (type, examens disponibles, planning, prélèvement domicile, résultats rapides, RDV en ligne)
  - Ajouter règles spécifiques pour laboratoire vs centre imagerie vs mixte

- [ ] **prompt_10**: Intégrer toutes les configurations particulières dans le prompt
  - Section dédiée pour chaque type de formulaire spécial
  - Exemples de JSON attendu pour chaque catégorie

---

## 🗄️ PHASE 2 : BASE DE DONNÉES

### 2.1 Tables Historisation
- [ ] **db_1**: Créer migration SQL pour table `autocomplete_characteristics`
  - Colonnes: id, identifiant_base, sous_caracteristique, valeur, usage_count, zone_geographique, gps_zone, last_used_at, created_at
  - Index sur identifiant_base+sous_caracteristique, zone_geographique, usage_count

- [ ] **db_2**: Créer migration SQL pour table `search_history`
  - Colonnes: id, user_id, query, category, zone_geographique, results_count, clicked_result_id, usage_count, last_used_at
  - Index sur user_id+query, category, usage_count

### 2.2 Extraction GPS/Ville depuis Requête
- [ ] **backend_5**: Modifier router_yukpo.rs pour extraire GPS/ville depuis requête
  - Parser gps_fixe, ville, quartier depuis input utilisateur
  - Passer ces informations au prompt IA pour contextualisation

---

## ⚙️ PHASE 3 : BACKEND

### 3.1 Service Historisation
- [ ] **backend_1**: Créer service Rust `AutocompleteHistoryService`
  - Méthodes: save_characteristics, get_suggestions, get_all_combinations, get_search_suggestions
  - Intégration avec table autocomplete_characteristics

- [ ] **backend_2**: Créer routes API backend pour autocomplete
  - GET /api/autocomplete/suggestions?identifiant_base=&sous_caracteristique=&prefix=&zone=
  - POST /api/autocomplete/save (historiser caractéristiques)
  - GET /api/autocomplete/combinations?identifiant_base=&zone= (pour filtres)

- [ ] **backend_3**: Intégrer historisation dans création service
  - Parser produits créés et sauvegarder dans autocomplete_characteristics
  - Appeler automatiquement lors de la création d'un service avec produits

- [ ] **backend_4**: Créer routes API pour search_history
  - POST /api/search/history (sauvegarder recherche)
  - GET /api/search/history/suggestions?query=&category=&zone= (suggestions)

### 3.2 Recherche par Image
- [ ] **backend_image_1**: Analyser comportement création service avec image
  - Comparer JSON généré par IA lors création vs recherche
  - Identifier différences dans traitement image

- [ ] **backend_image_2**: Améliorer matching recherche par image
  - Utiliser même logique d'analyse que création
  - Améliorer extraction caractéristiques depuis image pour recherche
  - Tester matching avec produits créés avec images

### 3.3 Recherche Produits (Champs Produits)
- [ ] **backend_search_1**: Analyser recherche actuelle dans native_search_service.rs
  - Vérifier si champs produits sont inclus dans recherche
  - Identifier pourquoi seulement champs généraux sont recherchés

- [ ] **backend_search_2**: Enrichir recherche pour inclure tous les champs produits
  - Ajouter recherche dans produits.nom, produits.caracteristiques_autocomplete, etc.
  - Inclure recherche dans sous-caractéristiques séparées
  - Tester recherche avec produits créés

---

## 📱 PHASE 4 : FRONTEND MOBILE - SERVICES

### 4.1 Services Historisation
- [ ] **frontend_service_1**: Créer service TypeScript `AutocompleteHistoryService.ts`
  - Méthodes: saveCharacteristics, getSuggestions, getAllCombinations, getSearchSuggestions, detectIdentifiantBase
  - Appels API vers backend

- [ ] **frontend_service_2**: Créer service `SearchHistoryService.ts`
  - Méthodes: saveSearch, getHistory, getSuggestions
  - Intégration avec AsyncStorage pour cache local

### 4.2 Historisation Manuelle
- [ ] **frontend_histo_1**: Modifier soumettreFormulaire pour historiser caractéristiques créées manuellement
  - Détecter si produit créé via duplication (pas IA)
  - Parser caracteristiques_autocomplete même si créées manuellement
  - Sauvegarder dans autocomplete_characteristics avec origine_champs="utilisateur"

---

## 🎨 PHASE 5 : FRONTEND MOBILE - COMPOSANTS

### 5.1 Composants Nouveaux
- [ ] **frontend_component_1**: Créer composant `AutocompleteGranularEditor.tsx`
  - Permet modification granulaire d'une modalité (éditer une sous-valeur sans tout re-saisir)
  - Parser modalité en sous-valeurs
  - Reconstruire modalité complète après modification

- [ ] **frontend_component_2**: Créer composant `PriceVariantSelector.tsx`
  - Affiche liste déroulante avec prix associés pour variabilité de prix
  - Gestion stock disponible par variante

- [ ] **frontend_component_3**: Créer composant `IntelligentSearchBar.tsx`
  - Barre de recherche avec autocomplete historisé
  - Suggestions contextuelles basées sur historique
  - Détection pattern autocomplete vs recherche générale

### 5.2 Gestion Médias
- [ ] **media_1**: Supprimer contraintes limites vidéo
  - Modifier cloudUpload.ts pour retirer maxSize pour video (ligne 68)
  - Modifier canUploadFile pour retirer limite 50MB vidéo
  - Retirer videoMaxDuration dans CreatePubliciteScreen (ligne 183)

- [ ] **media_2**: Positionner image service comme première image produit
  - Modifier soumettreFormulaire dans FormulaireYukpoIntelligentScreen
  - Si image transmise lors création service, l'ajouter en premier dans produits[0].images
  - Sauvegarder dans table media avec product_index=0

---

## 🔄 PHASE 6 : REFONTE FORMULAIREYUKPOINTELLIGENTSCREEN

### 6.1 Suppression ProductManagerMobile
- [ ] **formulaire_refonte_1**: Supprimer import et utilisation ProductManagerMobile
  - Retirer import ligne 28
  - Retirer bloc products avec _products_manager (lignes 810-832)
  - Retirer state products et logique associée

### 6.2 Système Intégré Produit Unique
- [ ] **formulaire_refonte_2**: Modifier processIASuggestion pour générer champs produit_*
  - Détecter suggestion.data.produits[0] (premier produit uniquement)
  - Générer champs dynamiques: produit_nom, produit_type_produit, produit_caracteristiques_autocomplete, etc.
  - Organiser dans bloc "Produit" dédié

- [ ] **formulaire_refonte_3**: Modifier organizeFieldsIntoBlocks
  - Organiser champs produit_* dans bloc Produit dédié
  - Retirer logique bloc products avec _products_manager

- [ ] **formulaire_refonte_4**: Modifier renderField pour détecter nouveaux types
  - Détecter type_donnee="autocomplete" → rendre AutocompleteGranularEditor
  - Détecter type_donnee="price_variant" → rendre PriceVariantSelector
  - Autres champs normaux

### 6.3 Duplication Granulaire
- [ ] **formulaire_refonte_5**: Implémenter duplication granulaire de produit
  - Fonction duplicateProductWithGranularEdit
  - Extraire première modalité comme base
  - Parser en sous-valeurs
  - Ouvrir AutocompleteGranularEditor pour modification

- [ ] **formulaire_refonte_6**: Maintenir coût lors duplication
  - Conserver tokens_consumed du produit original
  - Appliquer même coût lors création produit dupliqué
  - Ne pas appeler IA externe pour duplication

### 6.4 Soumission et Historisation
- [ ] **formulaire_refonte_7**: Modifier soumettreFormulaire pour reconstruire tableau produits
  - Collecter tous les champs produit_*
  - Reconstruire structure produits pour backend
  - Historiser automatiquement caracteristiques_autocomplete

---

## 🔍 PHASE 7 : RECHERCHE ET FILTRAGE

### 7.1 HomeScreen
- [ ] **homescreen_1**: Remplacer ChatInputMobile par IntelligentSearchBar
  - Intégrer autocomplete historisé
  - Détecter catégorie et zone géographique
  - Passer à IntelligentSearchBar

- [ ] **homescreen_2**: Implémenter scroll produits selon habitudes utilisateur
  - Analyser userBehaviorService pour habitudes
  - Créer carousel horizontal avec produits selon préférences
  - Intégrer dans HomeScreen

- [ ] **homescreen_3**: Implémenter scroll automatique publicités
  - Carousel horizontal pour publicités
  - Scroll automatique toutes les 5 secondes
  - Intégrer dans HomeScreen

### 7.2 ResultatBesoinScreen
- [ ] **resultatbesoin_1**: Corriger crash lors recherche
  - Comparer handleSearch HomeScreen vs ResultatBesoinScreen
  - Identifier différences causant crash
  - Aligner code sur HomeScreen (sans partie création)

- [ ] **resultatbesoin_2**: Remplacer SearchBar par IntelligentSearchBar
  - Intégrer autocomplete historisé
  - Passer category et zoneGeographique

- [ ] **resultatbesoin_3**: Corriger affichage cartes produit (vides à gauche)
  - Analyser styles ProductCard
  - Retirer paddingHorizontal/marginHorizontal excessifs
  - Faire occuper toute la largeur écran (width: '100%')

- [ ] **resultatbesoin_4**: Intégrer filtrage par caractéristiques autocomplete
  - Charger combinaisons depuis AutocompleteHistoryService
  - Générer filtres dynamiques dans CategoryFilters
  - Filtrer produits selon sous-caractéristiques sélectionnées

- [ ] **resultatbesoin_5**: Vérifier alignement zone filtrage avec nouvelle configuration
  - Analyser CategoryFilters.tsx
  - Vérifier si categoryConfig.ts toujours nécessaire
  - Adapter filtres selon nouvelles structures produits

---

## ✅ PHASE 8 : VALIDATION SCHÉMA DE DONNÉES

### 8.1 Schéma JSON Backend
- [ ] **schema_1**: Analyser schéma actuel service_schema.json
  - Localiser fichier src/schemas/service_schema.json
  - Comprendre structure actuelle et validation jsonschema

- [ ] **schema_2**: Ajouter nouveaux types de données dans service_schema.json
  - Ajouter type "autocomplete" avec structure complète (valeur, separateur, sous_caracteristiques, identifiant_base, filtrable)
  - Ajouter type "price_variant" avec structure complète (variable, modalites, filtrable)
  - S'assurer compatibilité avec structure existante

- [ ] **schema_3**: Mettre à jour valider_service_json dans creer_service.rs
  - Ajouter validation spécifique pour type_donnee="autocomplete"
  - Ajouter validation spécifique pour type_donnee="price_variant"
  - Vérifier que tous les champs requis sont présents

- [ ] **schema_4**: Tester validation avec exemples concrets
  - Créer JSON avec caracteristiques_autocomplete valide
  - Créer JSON avec variabilite_prix valide
  - Vérifier que validation passe correctement

### 8.2 Interprétation Frontend React Native
- [ ] **frontend_schema_1**: Analyser formDispatcher.ts pour interprétation type_donnee
  - Vérifier comment createFieldComponent interprète type_donnee actuellement
  - Identifier où ajouter logique pour nouveaux types

- [ ] **frontend_schema_2**: Ajouter interprétation type_donnee="autocomplete" dans formDispatcher.ts
  - Créer logique pour parser modalités concaténées
  - Extraire sous-caractéristiques séparées
  - Générer composant AutocompleteGranularEditor

- [ ] **frontend_schema_3**: Ajouter interprétation type_donnee="price_variant" dans formDispatcher.ts
  - Parser structure variabilite_prix
  - Générer composant PriceVariantSelector
  - Gérer modalités avec prix associés

- [ ] **frontend_schema_4**: Tester interprétation dans FormulaireYukpoIntelligentScreen
  - Vérifier que champs autocomplete s'affichent correctement
  - Vérifier que champs price_variant s'affichent correctement
  - Tester avec données réelles générées par IA

- [ ] **frontend_schema_5**: Documenter nouveaux types pour développeurs
  - Créer fichier documentation types_donnees.md
  - Expliquer structure autocomplete et price_variant
  - Donner exemples d'utilisation

- [ ] **frontend_schema_6**: Règle CRITIQUE - Tous les champs prix doivent être numériques
  - Valider dans prompt IA que tous les prix sont des nombres (pas strings)
  - Valider dans service_schema.json que type_donnee="number" pour prix
  - Valider dans valider_service_json que prix est numérique
  - Valider dans formDispatcher.ts que prix est interprété comme nombre
  - Vérifier variabilite_prix.modalites[].prix aussi numérique

- [ ] **frontend_schema_7**: Ajouter interprétation type_donnee="date" dans formDispatcher.ts
  - Détecter type_donnee="date" ou champs contenant "date" dans nom
  - Générer composant DatePicker pour React Native
  - Gérer format date ISO (YYYY-MM-DD) pour backend
  - Valider format date dans service_schema.json

- [ ] **frontend_schema_8**: Intégrer Google Maps Autocomplete pour champs lieux
  - Analyser ModernGPSModal.tsx pour comprendre intégration Google Places API
  - Détecter champs contenant "lieu", "adresse", "localisation", "ville", "quartier"
  - Générer composant avec Google Places Autocomplete (comme ModernGPSModal)
  - Utiliser ENVIRONMENT.GOOGLE_MAPS_API_KEY depuis config/environment.ts
  - Intégrer dans formDispatcher.ts pour champs de type lieu

---

## 🧪 PHASE 9 : TESTS ET VALIDATION

### 9.1 Tests Fonctionnels
- [ ] **test_1**: Tester création produit avec autocomplete
  - Vérifier génération 8-10 modalités
  - Vérifier structure avec sous-caractéristiques séparées
  - Vérifier historisation automatique

- [ ] **test_2**: Tester duplication granulaire
  - Vérifier modification d'une sous-valeur
  - Vérifier reconstruction modalité complète
  - Vérifier coût maintenu

- [ ] **test_3**: Tester recherche avec autocomplete historisé
  - Vérifier suggestions dans HomeScreen
  - Vérifier suggestions dans ResultatBesoinScreen
  - Vérifier matching avec produits créés

- [ ] **test_4**: Tester recherche par image
  - Créer service avec image
  - Rechercher avec même image
  - Vérifier matching correct

- [ ] **test_5**: Tester recherche dans champs produits
  - Créer produit avec caracteristiques_autocomplete
  - Rechercher par valeur dans autocomplete
  - Vérifier résultat trouvé

### 8.2 Tests Formulaires Particuliers
- [ ] **test_6**: Tester création ticket_voyage
  - Vérifier génération tous champs spéciaux
  - Vérifier structure conforme ProductManagerMobile

- [ ] **test_7**: Tester création pharmacie
  - Vérifier type, heures, jours, services
  - Distinction garde vs normale

- [ ] **test_8**: Tester création hopital_clinique
  - Vérifier type établissement, prestations, planning
  - Distinction hôpital vs clinique

- [ ] **test_9**: Tester création laboratoire
  - Vérifier type, examens, planning
  - Distinction laboratoire vs imagerie vs mixte

---

## 📝 NOTES IMPORTANTES

### Points d'attention
1. **Historisation manuelle**: Même si produit créé manuellement (duplication), historiser les caractéristiques
2. **Coût duplication**: Maintenir tokens_consumed original, ne pas re-appeler IA
3. **Médias**: Image service → première image produit automatiquement
4. **Recherche produits**: Inclure TOUS les champs produits, pas seulement généraux
5. **Recherche image**: Utiliser même logique que création pour matching
6. **Cartes produit**: Occuper toute largeur, pas de vides à gauche
7. **Filtrage**: Aligner avec nouvelles structures, vérifier categoryConfig

### Ordre d'implémentation recommandé
1. Prompt IA (Phase 1) - Base de tout
2. Base de données (Phase 2) - Structure nécessaire
3. Validation schéma (Phase 8) - CRITIQUE : Doit être fait tôt pour valider structures
4. Backend services (Phase 3) - API nécessaires
5. Frontend services (Phase 4) - Services utilisés par composants
6. Composants (Phase 5) - Composants utilisés par formulaires
7. Refonte formulaire (Phase 6) - Utilise composants
8. Recherche et filtrage (Phase 7) - Utilise services et composants
9. Tests (Phase 9) - Validation finale

