# 🎯 PROMPT 1 : MISE À JOUR SERVICES EXISTANTS (Bourse du Livre, Orientation Scolaire, Offre d'Emploi)

Je souhaite une expérience UX unique et rivalisant avec les plus grandes plateformes occidentales pour améliorer 3 services spécialisés existants dans Yukpomnang : Bourse du Livre, Orientation Scolaire, et Offre d'Emploi.

⚠️ ATTENTION CRITIQUE : Ne commence PAS par créer ou améliorer. Beaucoup de choses existent déjà. Tu DOIS d'abord analyser complètement l'existant avant d'apporter des améliorations cohérentes et bénéfiques.

## 🔍 PHASE 1 : ANALYSE COMPLÈTE DE L'EXISTANT

### A. Analyse Backend
1. **Services Rust existants** : Analyse tous les fichiers dans `backend/src/services/` liés à :
   - `bourse_livre_service.rs` ou services de livre
   - `orientation_scolaire_service.rs` ou services d'orientation
   - `offres_emploi_service.rs` (existe déjà avec matching, alertes, statistiques)

2. **Contrôleurs existants** : Vérifie `backend/src/controllers/` pour :
   - Contrôleurs spécialisés existants
   - Routes déjà implémentées dans `backend/src/routes/`

3. **Modèles de données** : Analyse les migrations SQL dans `backend/migrations/` pour comprendre :
   - Tables existantes pour chaque service
   - Relations entre tables
   - Index déjà créés

4. **Services IA existants** : Inspire-toi de la structure dans :
   - `backend/src/services/hospital_ai_service.rs`
   - `backend/src/services/pharmacy_ai_service.rs`
   - `backend/src/services/lab_ai_service.rs`
   - `backend/src/services/blood_bank_ai_service.rs`
   
   Vérifie si des services IA existent déjà pour nos 3 services cibles.

### B. Analyse Frontend Mobile
1. **Écrans existants** :
   - `mobile/src/screens/BourseLivreScreen.tsx`
   - `mobile/src/screens/orientation/OrientationScolaireHubScreen.tsx`
   - `mobile/src/screens/offres-emploi/OffresEmploiHubScreen.tsx`

2. **Composants spécialisés** : Vérifie les composants dans `mobile/src/components/` liés à ces services

3. **Configuration** : Analyse `mobile/src/config/categoryConfig.ts` pour voir les configurations existantes

4. **Services API** : Vérifie `mobile/src/services/` pour les services TypeScript existants

### C. Analyse Frontend Web
1. **Pages existantes** dans `frontend/src/pages/`
2. **Composants réutilisables** dans `frontend/src/components/`

### D. Documentation existante
- `RAPPORT_FINAL_EMPLOI.md` - Analyse complète pour Offres d'Emploi
- Tous les fichiers `.md` mentionnant ces services

## 🎯 PHASE 2 : COMPARAISON AVEC LES LEADERS MONDAUX

Pour chaque service, compare avec les leaders occidentaux :

### Bourse du Livre
- **Rakuten Kobo**, **Amazon Books**, **Leboncoin Livres**
- Analyse : fonctionnalités, UX, navigation, recherche, matching

### Orientation Scolaire
- **Studyportals**, **Campus France**, **The Princeton Review**
- Analyse : parcours utilisateur, recommandations IA, filtres, présentation

### Offre d'Emploi
- **LinkedIn**, **Indeed**, **Glassdoor**, **Monster**
- Analyse : matching, alertes, recherche avancée, profil candidat

## 🚀 PHASE 3 : PLAN D'AMÉLIORATION PAR SERVICE

### Structure du Plan (adaptée selon contexte/objectif de chaque service)

#### 3.1 BOURSE DU LIVRE

**Contexte** : Échange et vente de livres scolaires et universitaires  
**Objectif** : Faciliter les échanges entre étudiants, recommandations intelligentes

**Améliorations UX/UI** :
- Design moderne et attrayant inspiré Rakuten/Amazon
- Navigation fluide entre recherche, échange, achat
- Visualisation livres avec galerie images
- Filtres avancés : classe, matière, état, prix, localisation
- Matching intelligent : besoins ↔ offres
- Recommandations IA basées sur programme scolaire

**Fonctionnalités Backend** :
- Service IA : `book_exchange_ai_service.rs`
  - Recommandations livres selon classe/matière
  - Matching intelligent besoins/offres
  - Suggestions prix basées sur marché
- Endpoints :
  - `POST /api/bourse-livre/ai/recommendations` - Recommandations IA
  - `POST /api/bourse-livre/ai/matching` - Matching intelligent
  - `GET /api/bourse-livre/price-suggestions` - Suggestions prix
  - `GET /api/bourse-livre/my-exchanges` - Mes échanges (JWT)
  - `GET /api/bourse-livre/analytics` - Analytics prestataire (JWT)

**Migrations SQL** :
- Créer fichier `backend/migrations/20250127_create_bourse_livre_advanced_tables.sql`
- Tables : `book_exchanges`, `book_recommendations`, `book_price_history`, `book_analytics`
- Intégrer dans `backend/src/migrations/auto_migrate.rs`

**Frontend Mobile** :
- Améliorer `BourseLivreScreen.tsx` avec :
  - Recherche intelligente avec autocomplete
  - Filtres visuels modernes
  - Cards livres améliorées (images, état, prix)
  - Boutons actions contextuelles (Échanger, Acheter, Contacter)
  - Intégration chat via `ChatModalMobile`
  - Avis/ratings via `ProductCommentsSection`

**Scalabilité** :
- Index optimisés pour recherche texte (Full-text search)
- Cache Redis pour recommandations IA
- Pagination efficace
- Support millions de transactions/seconde

#### 3.2 ORIENTATION SCOLAIRE

**Contexte** : Aide étudiants à choisir filières, établissements, carrières  
**Objectif** : Orientation personnalisée avec IA, parcours guidé

**Améliorations UX/UI** :
- Design moderne type Studyportals
- Parcours guidé étape par étape
- Visualisations interactives (graphiques, comparaisons)
- Filtres avancés : domaine, niveau, localisation, budget
- Matching intelligent : profil étudiant ↔ programmes
- Recommandations IA personnalisées

**Fonctionnalités Backend** :
- Service IA : `orientation_scolaire_ai_service.rs`
  - Analyse profil étudiant (notes, intérêts, objectifs)
  - Recommandations filières/établissements
  - Comparaison programmes
  - Prévisions débouchés
- Endpoints :
  - `POST /api/orientation/ai/analyze-profile` - Analyse profil IA
  - `POST /api/orientation/ai/recommendations` - Recommandations IA
  - `POST /api/orientation/ai/compare-programs` - Comparaison programmes
  - `GET /api/orientation/my-profile` - Mon profil (JWT)
  - `GET /api/orientation/analytics` - Analytics établissement (JWT)

**Migrations SQL** :
- Créer fichier `backend/migrations/20250127_create_orientation_scolaire_advanced_tables.sql`
- Tables : `student_profiles`, `program_recommendations`, `program_comparisons`, `orientation_analytics`
- Intégrer dans `backend/src/migrations/auto_migrate.rs`

**Frontend Mobile** :
- Améliorer `OrientationScolaireHubScreen.tsx` avec :
  - Questionnaire interactif profil
  - Résultats visuels (graphiques, scores)
  - Comparaison établissements côte à côte
  - Filtres visuels avancés
  - Intégration chat avec conseillers
  - Historique recommandations

**Scalabilité** :
- Cache IA pour recommandations
- Index géospatial pour recherche établissements
- Support millions d'étudiants

#### 3.3 OFFRE D'EMPLOI

**Contexte** : Déjà bien développé (voir `RAPPORT_FINAL_EMPLOI.md`)  
**Objectif** : Finaliser et améliorer selon analyse du rapport

**Améliorations basées sur rapport** :
- Vérifier cohérence noms champs (déjà corrigé)
- Compléter filtres manquants
- Enrichir affichage ProductCard
- Améliorer matching avec IA

**Fonctionnalités Backend** :
- Service IA : `emploi_ai_service.rs` (vérifier si existe, sinon créer)
  - Matching intelligent CV ↔ offres
  - Analyse compétences
  - Suggestions formations
  - Prédictions salaires
- Endpoints :
  - `POST /api/offres-emploi/ai/matching` - Matching intelligent
  - `POST /api/offres-emploi/ai/analyze-cv` - Analyse CV IA
  - `GET /api/offres-emploi/ai/salary-prediction` - Prédiction salaire
  - (Endpoints existants déjà : dashboard, candidatures, etc.)

**Frontend Mobile** :
- Finaliser selon `RAPPORT_FINAL_EMPLOI.md`
- Améliorer UX avec design moderne LinkedIn/Indeed
- Intégration complète chat et avis

**Scalabilité** :
- Déjà prévue dans architecture existante

## 🔧 CONTRAINTES TECHNIQUES

### Migrations SQL
1. **Créer fichiers numérotés** dans `backend/migrations/` :
   - Format : `YYYYMMDD_create_[service]_advanced_tables.sql`
   - Exemple : `20250127_create_bourse_livre_advanced_tables.sql`

2. **Intégrer dans auto_migrate.rs** :
   - Ajouter l'appel dans `backend/src/migrations/auto_migrate.rs`
   - Suivre le pattern des migrations hospital/pharmacy/lab

3. **Appliquer sur Render** :
   - Database URL Render : `postgresql://user:password@host:port/database`
   - Vérifier application via logs Render

### Services IA
1. **Utiliser le système IA existant** :
   - Utiliser `AppIA` comme dans `hospital_ai_service.rs`
   - Créer prompts spécifiques dans `backend/src/services/ia/prompts/`

2. **Structure service IA** :
   - Implémenter struct `[Service]AIService { app_ia: Arc<AppIA> }`
   - Méthodes async avec gestion d'erreurs
   - Parsing JSON avec fallback gracieux
   - Logging tokens consommés

3. **Intégration dans mod.rs** :
   - Ajouter `pub mod [service]_ai_service;` dans `backend/src/services/mod.rs`

### Endpoints Backend
1. **Créer dans contrôleur** :
   - Ajouter dans `backend/src/controllers/specialized_services_controller.rs`
   - Suivre pattern hospital/pharmacy/lab

2. **Routes** :
   - Ajouter dans `backend/src/routes/specialized_services_routes.rs`
   - Protéger avec JWT si nécessaire

### Frontend Mobile
1. **Services TypeScript** :
   - Créer/améliorer dans `mobile/src/services/`
   - Utiliser `apiGet` et `apiPost` de `api.ts`

2. **Écrans** :
   - Améliorer écrans existants
   - Intégrer `ChatModalMobile` et `ProductCommentsSection`
   - Utiliser composants `NativeDesign` (NativeCard, NativeButton, etc.)

3. **Navigation** :
   - Vérifier routes dans `AppNavigator.tsx`
   - Cohérence avec navigation existante

### Scalabilité
- **Millions de transactions/seconde** :
  - Cache Redis pour données fréquentes
  - Index optimisés en base
  - Pagination efficace
  - Requêtes optimisées (EXPLAIN)
  - Support scaling horizontal (Redis partagé)

## 🎨 EXPÉRIENCE UTILISATEUR EXCEPTIONNELLE

### Design Visuel
- Inspirer des leaders occidentaux (Rakuten, LinkedIn, Studyportals)
- Design moderne, épuré, professionnel
- Animations fluides et naturelles
- Responsive (mobile, tablette, desktop)
- Thème cohérent avec Yukpomnang

### Navigation
- Navigation intuitive, fluide
- Accès naturel aux fonctionnalités principales
- Breadcrumbs pour orientation
- Retours navigation logiques
- Transitions douces entre écrans

### Fonctionnalités
- Autocomplete intelligent pour recherche
- Filtres visuels et interactifs
- Actions contextuelles claires
- Feedback utilisateur immédiat
- Gestion erreurs gracieuse

### Expérience Client/Prestataire
- Expérience client : recherche, réservation, paiement fluide
- Expérience prestataire : gestion facile, analytics clairs
- Séparation claire des rôles
- Dashboard adapté selon rôle

## 📊 COMPARAISON AVEC LES GÉANTS

Pour chaque service, faire une comparaison détaillée :

| Aspect | Leader Occidental | Notre Niveau Actuel | Améliorations Nécessaires |
|--------|-------------------|---------------------|---------------------------|
| Design | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Design moderne, animations |
| Navigation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Fluidité, intuitivité |
| Fonctionnalités | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | IA, matching, recommandations |
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Cache, optimisation |
| Scalabilité | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Scaling horizontal |

## ✅ VÉRIFICATIONS FINALES

- [ ] Analyse complète existant effectuée
- [ ] Comparaison avec leaders effectuée
- [ ] Plan d'amélioration par service créé
- [ ] Migrations SQL créées et intégrées
- [ ] Services IA créés avec prompts opérationnels
- [ ] Endpoints backend créés et routés
- [ ] Frontend mobile amélioré
- [ ] Tests de linting passés
- [ ] Scalabilité vérifiée
- [ ] Documentation mise à jour

---

**Commence par l'analyse complète de l'existant. Ne crée rien avant d'avoir tout analysé.**

