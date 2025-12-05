# ✅ Guide de test des écrans mobiles IA

## Écrans à tester

### 1. Bourse du Livre
- **Écran**: `BourseLivreScreen.tsx`
- **Navigation**: `BourseLivre`
- **Fonctionnalités**:
  - Recherche de livres
  - Filtres (classe, matière, état)
  - Recommandations IA
  - Suggestions prix IA
  - Matching IA

### 2. Orientation Scolaire

#### Profil Étudiant
- **Écran**: `ProfilEtudiantScreen.tsx`
- **Navigation**: `ProfilEtudiant`
- **Fonctionnalités**:
  - Création/mise à jour profil
  - Informations académiques
  - Matières préférées
  - Budget

#### Analyse Profil IA
- **Écran**: `OrientationAIProfileAnalysisScreen.tsx`
- **Navigation**: `OrientationAIProfileAnalysis`
- **Fonctionnalités**:
  - Analyse complète du profil
  - Points forts/faibles
  - Filières suggérées
  - Recommandations personnalisées

#### Recommandations Programmes IA
- **Écran**: `OrientationAIRecommendationsScreen.tsx`
- **Navigation**: `OrientationAIRecommendations`
- **Fonctionnalités**:
  - Génération recommandations
  - Scores de pertinence
  - Détails établissements

#### Comparaison Programmes IA
- **Écran**: `OrientationAICompareProgramsScreen.tsx`
- **Navigation**: `OrientationAIComparePrograms`
- **Fonctionnalités**:
  - Comparaison 2 programmes
  - Scores détaillés
  - Recommandation finale

### 3. Offres d'Emploi

#### Analyse CV IA
- **Écran**: `AnalyseCVScreen.tsx`
- **Navigation**: `AICVAnalysis`
- **Fonctionnalités**:
  - Upload/texte CV
  - Analyse complétude/qualité
  - Compétences extraites
  - Suggestions amélioration

#### Prédiction Salaire IA
- **Écran**: `AISalaryPredictionScreen.tsx`
- **Navigation**: `AISalaryPrediction`
- **Fonctionnalités**:
  - Formulaire poste
  - Prédiction min/max/médian
  - Facteurs influence
  - Comparaison marché

#### Suggestions Formations IA
- **Écran**: `AISuggestFormationsScreen.tsx`
- **Navigation**: `AISuggestFormations`
- **Fonctionnalités**:
  - Génération suggestions
  - Compétences ciblées
  - Durée/coût formations

## Checklist de test

### Prérequis
- [ ] Backend démarré et accessible
- [ ] Migrations appliquées
- [ ] Utilisateur connecté (pour endpoints protégés)
- [ ] Profil étudiant créé (pour Orientation Scolaire)

### Tests fonctionnels

#### Bourse du Livre
- [ ] Recherche retourne des résultats
- [ ] Filtres fonctionnent correctement
- [ ] Recommandations IA générées
- [ ] Suggestions prix affichées
- [ ] Matching IA fonctionne

#### Orientation Scolaire
- [ ] Profil étudiant peut être créé/modifié
- [ ] Analyse profil retourne des résultats
- [ ] Recommandations programmes générées
- [ ] Comparaison programmes fonctionne
- [ ] Navigation entre écrans fluide

#### Offres d'Emploi
- [ ] Analyse CV retourne des scores
- [ ] Prédiction salaire affiche fourchette
- [ ] Suggestions formations générées
- [ ] Compétences extraites correctement

### Tests d'erreur
- [ ] Gestion erreur réseau
- [ ] Messages d'erreur clairs
- [ ] Fallback si IA indisponible
- [ ] Validation formulaires

### Tests UX
- [ ] Loading states affichés
- [ ] Pull-to-refresh fonctionne
- [ ] Navigation intuitive
- [ ] Design cohérent

## Commandes de test

```bash
# Démarrer le backend
cd backend
cargo run

# Démarrer l'app mobile
cd mobile
npm start

# Tester les endpoints
./scripts/test_ai_endpoints.sh http://localhost:3000
```

## Endpoints à vérifier

### Bourse du Livre
- `GET /api/bourse-livre/search` (publique)
- `GET /api/bourse-livre/ai/price-suggestions` (publique)
- `POST /api/bourse-livre/ai/recommendations` (protégé)
- `POST /api/bourse-livre/ai/matching` (protégé)

### Orientation Scolaire
- `GET /api/orientation/my-profile` (protégé)
- `POST /api/orientation/my-profile` (protégé)
- `POST /api/orientation/ai/analyze-profile` (protégé)
- `POST /api/orientation/ai/recommendations` (protégé)
- `POST /api/orientation/ai/compare-programs` (protégé)

### Offres d'Emploi
- `GET /api/offres-emploi/ai/salary-prediction` (publique)
- `POST /api/offres-emploi/ai/analyze-cv` (protégé)
- `POST /api/offres-emploi/ai/suggest-formations` (protégé)

