# 🍽️ PROMPT 3 : CRÉATION SERVICE PLANIFICATION MENUS (À ÉLABORER ENSEMBLE)

Je souhaite créer un nouveau service spécialisé YUKPOMNANG pour aider les femmes à planifier leurs menus de la semaine. Ce service est encore en phase de conceptualisation, je veux que tu m'aide à l'élaborer complètement.

## 🎯 CONCEPT INITIAL

**Objectif principal** : Aider les femmes à planifier leurs menus hebdomadaires pour ne plus se casser la tête, avec :
- Planification menu de la semaine
- Calcul automatique quantités selon nombre de personnes
- Intégration avec autres services Yukpo pour achats
- Menus diététiques et de régime
- Menus contextualisés (culturel, saisonnier, budget)

## 🔍 PHASE 1 : CONCEPTUALISATION COMPLÈTE

### Questions à Élaborer Ensemble

#### A. Fonctionnalités Core
1. **Planification menus** :
   - Menu de la semaine complète ?
   - Menu jour par jour ?
   - Suggestions automatiques ou création manuelle ?
   - Combien de repas par jour (petit-déj, déj, dîner, goûter) ?

2. **Gestion personnes** :
   - Profil famille (nombre personnes, âges, préférences) ?
   - Calcul quantités automatique selon recettes ?
   - Gestion allergies/intolérances ?

3. **Intégration achats** :
   - Liste de courses automatique générée ?
   - Lien avec services Yukpo (marchés, épiceries) ?
   - Comparaison prix entre prestataires ?
   - Commande directe depuis le service ?

4. **Types de menus** :
   - Menus diététiques (perte poids, gain muscle, santé) ?
   - Menus de régime (diabétique, hypertension, etc.) ?
   - Menus culturels (spécialités africaines, camerounaises) ?
   - Menus saisonniers (selon disponibilité produits) ?
   - Menus économiques (budget serré) ?

5. **Recettes** :
   - Base de données recettes intégrée ?
   - Recettes générées par IA ?
   - Recettes partagées communauté ?
   - Vidéos recettes ?

#### B. Expérience Utilisateur
1. **Workflow utilisateur** :
   - Comment l'utilisatrice commence (wizard, questionnaire) ?
   - Workflow semaine par semaine ou plan mensuel ?
   - Modification facile des menus planifiés ?
   - Historique menus précédents ?

2. **Personnalisation** :
   - Préférences alimentaires (végétarien, vegan, halal) ?
   - Budget mensuel/hebdomadaire ?
   - Temps disponible cuisine ?
   - Niveau cuisine (débutant, avancé) ?

3. **Interface** :
   - Calendrier visuel semaine ?
   - Liste courses organisée (par magasin, par rayon) ?
   - Notifications rappels (courses, préparation) ?
   - Mode hors ligne (synchronisation) ?

#### C. Fonctionnalités Avancées
1. **IA et Intelligence** :
   - Suggestions menus selon habitudes ?
   - Détection produits en promotion ?
   - Optimisation budget automatique ?
   - Adaptation saisonnière automatique ?
   - Analyse nutritionnelle (calories, protéines, etc.) ?

2. **Social et Communauté** :
   - Partage menus avec famille/amis ?
   - Recettes favorites communauté ?
   - Groupes cuisine (échanges recettes) ?
   - Challenges cuisine ?

3. **Intégrations** :
   - Calendrier Google/Apple (intégration repas) ?
   - Rappels notifications push ?
   - Partage liste courses avec famille ?

#### D. Modèle Business
1. **Rôles** :
   - Utilisatrices (femmes planifiant menus) ?
   - Prestataires (marchés, épiceries vendant produits) ?
   - Cuisiniers/Chefs (recettes premium) ?

2. **Monétisation** :
   - Service gratuit avec recettes basiques ?
   - Recettes premium payantes ?
   - Commission sur achats via plateforme ?
   - Abonnements mensuels (menus premium) ?

## 🚀 PHASE 2 : PROPOSITION ARCHITECTURE (À VALIDER)

### Architecture Proposée

#### Backend Rust
1. **Service IA** : `menu_planning_ai_service.rs`
   - Génération menus personnalisés
   - Suggestions recettes selon préférences
   - Calcul quantités automatique
   - Analyse nutritionnelle
   - Optimisation budget

2. **Endpoints** :
   - `POST /api/menus/ai/generate-week` - Générer menu semaine (IA)
   - `POST /api/menus/ai/suggest-recipes` - Suggérer recettes
   - `GET /api/menus/my-week` - Mon menu semaine (JWT)
   - `POST /api/menus/shopping-list` - Générer liste courses
   - `GET /api/menus/recipes/:id` - Détails recette
   - `POST /api/menus/analytics` - Analytics nutrition

3. **Migrations SQL** :
   - `menu_plans` - Plans menus utilisatrices
   - `recipes` - Base recettes
   - `shopping_lists` - Listes courses
   - `nutrition_analytics` - Analytics nutrition

#### Frontend Mobile
1. **Écrans** :
   - `MenuPlanningHubScreen.tsx` - Hub principal
   - `MenuWeekCalendarScreen.tsx` - Calendrier semaine
   - `RecipeDetailsScreen.tsx` - Détails recette
   - `ShoppingListScreen.tsx` - Liste courses
   - `MenuAISuggestionsScreen.tsx` - Suggestions IA
   - `NutritionAnalysisScreen.tsx` - Analyse nutrition

2. **Composants** :
   - `WeekCalendarView.tsx` - Calendrier visuel
   - `RecipeCard.tsx` - Card recette
   - `ShoppingListOrganized.tsx` - Liste organisée
   - `NutritionChart.tsx` - Graphiques nutrition

### Comparaison avec Leaders
- **Mealime** : Planification menus, liste courses
- **Yummly** : Recettes personnalisées, IA
- **Paprika** : Organisation recettes, planning
- **Meal Prep Pro** : Préparation repas

## 📝 QUESTIONS POUR ÉLABORATION ENSEMBLE

Avant de continuer l'implémentation, j'aimerais discuter avec toi :

1. **Quelle est la vision précise du service** ? (qui, quoi, comment, pourquoi)

2. **Quelles fonctionnalités sont MUST-HAVE vs NICE-TO-HAVE** ?

3. **Quel workflow utilisateur idéal** ? (parcours étape par étape)

4. **Comment intégrer avec achats Yukpo** ? (quel service, quel flux)

5. **Quel modèle business** ? (gratuit, premium, commissions)

6. **Quelles données/caractéristiques importantes** pour contextualisation ?

---

**Je t'invite à poser des questions pour mieux comprendre la vision, puis nous élaborerons ensemble l'architecture complète avant l'implémentation.**

## 🎯 SUGGESTIONS INITIALES POUR DÉBATTRE

### Vision Suggérée (À Affiner Ensemble)

**QUI** : Femmes gérant les repas familiaux, principalement en Afrique francophone (Cameroun, etc.)

**QUOI** : Service de planification intelligente de menus hebdomadaires avec :
- Génération automatique menus personnalisés
- Calcul quantités selon nombre de personnes
- Liste de courses intelligente
- Intégration achats Yukpo

**COMMENT** :
1. Utilisatrice remplit profil famille (nb personnes, âges, préférences, budget)
2. IA génère menu semaine personnalisé
3. Liste courses générée automatiquement
4. Commande via services Yukpo (marchés, épiceries)
5. Suivi nutrition et budget

**POURQUOI** : Faciliter la vie des femmes, économiser temps et argent, meilleure nutrition familiale

### Workflow Utilisateur Suggéré

1. **Onboarding** : Questionnaire profil famille
2. **Génération menu** : IA génère menu semaine
3. **Personnalisation** : Utilisatrice ajuste si besoin
4. **Liste courses** : Génération automatique
5. **Achats** : Commande via Yukpo ou courses manuelles
6. **Suivi** : Nutrition, budget, historique

### Intégration Achats Yukpo

- Lier avec service "Commerce" existant
- Comparaison prix entre prestataires
- Commande directe depuis liste courses
- Livraison ou retrait selon prestataire

### Modèle Business Suggéré

- **Gratuit** : Menus basiques, recettes simples
- **Premium** : Menus personnalisés avancés, recettes premium, nutrition détaillée
- **Commission** : Sur achats via plateforme Yukpo

---

**Qu'en penses-tu ? Quelles modifications ou précisions veux-tu apporter ?**

