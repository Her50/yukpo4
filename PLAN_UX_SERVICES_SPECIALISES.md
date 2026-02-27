# 🎯 PLAN COMPLET D'AMÉLIORATION UX — Services Spécialisés Yukpo

> **Date**: 25 février 2026  
> **Scope**: Santé (Pharmacie, Hôpital, Labo, Banque de sang), Transport (Taxi, Covoiturage), Immobilier, Offres d'Emploi  
> **Objectif**: Expérience utilisateur impeccable + exploitation maximale du backend

---

## 📊 RÉSUMÉ EXÉCUTIF

### Constat global
1. **IA externe cassée partout** — Les appels IA (OpenAI) échouent dans la majorité des services (pharmacie, hôpital, emploi, immobilier). Les écrans affichent des messages d'erreur génériques.
2. **Backend riche mais sous-exploité** — Le backend Rust expose ~60+ endpoints spécialisés, mais les écrans mobiles n'en utilisent que ~30%.
3. **UX fragmentée** — Chaque service a son propre style, ses propres patterns de navigation. Pas de cohérence visuelle.
4. **Fonctionnalités IA invisibles** — Les boutons IA existent mais ne sont pas mis en valeur et échouent silencieusement.
5. **Pas de parcours utilisateur fluide** — L'utilisateur doit deviner comment passer de la recherche à l'action (réserver, commander, postuler).

### Priorités de refonte
| Priorité | Domaine | Impact |
|----------|---------|--------|
| 🔴 P0 | Corriger les appels IA cassés (fallback local) | Critique |
| 🔴 P0 | Pharmacie — Refonte complète du parcours | Critique |
| 🟠 P1 | Hôpital — Exploiter disponibilité + IA pathologie | Élevé |
| 🟠 P1 | Taxi — Estimation tarifaire + tracking temps réel | Élevé |
| 🟠 P1 | Emploi — Parcours candidat complet avec IA | Élevé |
| 🟡 P2 | Covoiturage — Réservation + paiement intégré | Moyen |
| 🟡 P2 | Immobilier — Favoris, alertes prix, simulation prêt | Moyen |

---

## 🏥 1. SANTÉ

### 1.1 HealthServicesHubScreen (Point d'entrée santé)

**Fichier**: `mobile/src/screens/specialized/HealthServicesHubScreen.tsx`

#### Problèmes identifiés
- **Écran statique** — Simple grille de 4 cartes sans aucune donnée dynamique
- **Aucune info contextuelle** — Pas de pharmacie de garde actuelle, pas d'urgences proches
- **Pas de raccourci d'urgence** — Pour un hub santé, l'accès d'urgence est critique
- **Tips statiques** — Les conseils en bas sont codés en dur

#### Plan d'amélioration
1. **Bandeau d'urgence en haut** — Bouton rouge "🚨 Urgence" qui appelle le 119 ou navigue vers l'hôpital le plus proche (utilise GPS + `/api/search/medical-services`)
2. **Pharmacie de garde du jour** — Widget dynamique affichant la pharmacie de garde la plus proche (backend: `/api/pharmacies/search` avec `on_duty=true`)
3. **Compteur de services disponibles** — Afficher "12 pharmacies • 5 hôpitaux • 3 labos" à proximité via l'API unified
4. **Barre de recherche globale santé** — Recherche unifiée "Paracétamol", "Ophtalmologue", "Analyse sang" → redirige vers le bon sous-service
5. **Section "Mes dernières interactions"** — Historique des pharmacies/hôpitaux visités (backend: `/api/specialized-services/search-history`)

---

### 1.2 PharmacieHomeScreen (Pharmacie)

**Fichier**: `mobile/src/screens/specialized/PharmacieHomeScreen.tsx` (2575 lignes)  
**Service mobile**: `pharmacyProductService.ts` + `pharmacyService.ts`

#### Backend disponible mais NON EXPLOITÉ sur l'écran
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `POST /api/pharmacies/{id}/check-availability` | Vérifier dispo médicament | ❌ NON |
| `POST /api/pharmacies/{id}/reserve-medication` | Réserver médicament | ❌ NON |
| `POST /api/pharmacies/{id}/order` | Commander médicaments | ❌ NON |
| `POST /api/pharmacies/ai/interactions` | Interactions médicamenteuses IA | ⚠️ CASSÉ |
| `POST /api/pharmacies/ai/dosage` | Posologie IA | ⚠️ CASSÉ |
| `GET /api/pharmacies/my-orders` | Mes commandes | ❌ NON (écran séparé existe) |
| `GET /api/pharmacies/{id}/analytics` | Analytics prestataire | ❌ NON |
| `POST /api/pharmacies/products/budget` | Comparatif budget | ❌ NON |
| `GET /api/pharmacies/{id}/products` | Produits d'une pharmacie | ❌ NON |

#### Problèmes UX critiques
1. **IA cassée** — `handleAskAI()` et les modaux IA (posologie, interactions) appellent des endpoints qui renvoient des erreurs
2. **Pas de parcours achat** — L'utilisateur voit des médicaments mais ne peut ni vérifier la dispo, ni réserver, ni commander
3. **Analyse d'image non intégrée** — Le code existe (`imageAnalysisService`) mais n'est pas accessible depuis l'UI principale
4. **2575 lignes** — Fichier trop long, difficile à maintenir
5. **Tri côté client** — Le tri devrait être côté serveur pour les gros volumes

#### Plan de refonte complète

##### A. Nouveau parcours utilisateur Pharmacie
```
[Recherche médicament] → [Liste résultats avec prix/dispo] → [Détail pharmacie]
     ↓                            ↓                               ↓
[IA: Photo ordonnance]    [Comparer prix]                  [Vérifier stock]
                                                                  ↓
                                                           [Réserver / Commander]
                                                                  ↓
                                                           [Suivi commande]
```

##### B. Nouvelles sections sur l'écran principal
1. **Barre de recherche intelligente** — Avec suggestions IA en temps réel ("Paracétamol → Doliprane, Efferalgan...")
2. **Bouton "📷 Photo ordonnance"** — Analyse d'image pour identifier les médicaments (utilise `imageAnalysisService.analyzePharmacyImage()`)
3. **Section "💊 Pharmacies de garde"** — Liste des pharmacies ouvertes maintenant avec distance
4. **Carte des résultats** — Chaque médicament affiche: prix, pharmacie, distance, disponibilité en stock
5. **Bouton "Vérifier disponibilité"** sur chaque résultat → appelle `POST /api/pharmacies/{id}/check-availability`
6. **Bouton "🛒 Commander"** → `POST /api/pharmacies/{id}/order`
7. **Section "⚠️ Interactions"** — Quand l'utilisateur ajoute 2+ médicaments au panier, vérifier automatiquement les interactions
8. **"💰 Comparer les prix"** — Utiliser `POST /api/pharmacies/products/budget` pour comparer les prix entre pharmacies

##### C. Fix IA — Fallback intelligent
```typescript
// NOUVEAU: Fallback local quand l'IA externe échoue
const handleAskAI = async (question: string) => {
  try {
    // 1. Essayer l'API IA backend
    const response = await askAI(question, context);
    if (response?.message) return response;
  } catch (err) {
    // 2. Fallback: Utiliser le endpoint /api/ai/chat qui a son propre fallback
    try {
      const fallback = await apiPost('/api/ai/chat', {
        message: question,
        context: 'pharmacie',
        fallback: true
      });
      if (fallback.success) return fallback;
    } catch {}
  }
  // 3. Dernier recours: Réponses pré-programmées locales
  return getLocalPharmacyAnswer(question);
};
```

---

### 1.3 HopitalHomeScreen (Hôpital)

**Fichier**: `mobile/src/screens/specialized/HopitalHomeScreen.tsx` (1587 lignes)  
**Service mobile**: `hospitalService.ts`

#### Backend disponible mais NON EXPLOITÉ
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `GET /api/hopitaux/services/autocomplete` | Autocomplete prestations | ✅ OUI |
| `POST /api/hopitaux/ai/search-pathology` | Recherche pathologie IA | ⚠️ CASSÉ |
| `GET /api/search/medical-services` | Disponibilité services médicaux | ✅ OUI |
| Analyse d'image médicale | Vision IA pour radio/scan | ⚠️ CASSÉ |

#### Problèmes UX
1. **IA pathologie cassée** — `handleSearchPathology()` renvoie systématiquement des erreurs
2. **Analyse d'image cassée** — L'utilisateur peut prendre une photo mais l'analyse échoue
3. **Pas de système de RDV** — Le backend a `rdv_en_ligne` mais aucun écran de prise de RDV
4. **Pas d'urgences prioritaires** — Pour un service hôpital, afficher les urgences disponibles en priorité
5. **Pas de filtres par spécialité** — Cardiologie, ophtalmologie, pédiatrie...

#### Plan de refonte

##### A. Nouveau parcours utilisateur Hôpital
```
[Accueil] → [🔍 Recherche par symptôme/spécialité]
   ↓              ↓
[🚨 Urgences]  [Résultats avec disponibilité temps réel]
   ↓              ↓
[Hôpital le    [Détail hôpital → Services dispo → Prendre RDV]
 plus proche]     ↓
              [📷 Analyser radio/scan → Suggestion spécialité]
```

##### B. Nouvelles fonctionnalités
1. **Bouton 🚨 Urgences** en haut — Affiche les hôpitaux avec urgences ouvertes (`urgences_disponible = true`), triés par distance
2. **Grille de spécialités** — Cardiologie, Pédiatrie, Gynécologie, Ophtalmologie, Dentaire, Généraliste... avec icônes
3. **Recherche par symptôme IA** — "J'ai mal à la tête depuis 3 jours" → Suggestions de spécialité + hôpitaux
4. **Disponibilité temps réel** — Badge vert/rouge sur chaque hôpital ("Ouvert maintenant", "Urgences 24/7")
5. **Système de RDV** — Formulaire: date, heure, motif → Confirmer via WhatsApp/Appel
6. **Carte interactive** — Map avec pins des hôpitaux à proximité

##### C. Fix IA pathologie
```typescript
// Fallback pour recherche pathologie
const handleSearchPathology = async () => {
  try {
    const response = await hospitalService.searchPathology(query, undefined, location);
    if (response.success && response.results?.length > 0) {
      return response.results;
    }
  } catch {}
  
  // Fallback: Utiliser /api/ai/chat avec contexte médical
  const aiResponse = await apiPost('/api/ai/chat', {
    message: `Quels examens et spécialistes pour: ${query}`,
    context: 'medical',
    fallback: true
  });
  
  // Transformer la réponse en PathologySearchResult
  return parseAIChatToPathologyResults(aiResponse);
};
```

---

### 1.4 Banque de Sang (BanqueSangSearch)

**Fichiers**: `BanqueSangSearchScreen.tsx`, `BanqueSangListScreen.tsx`, `BanqueSangDetailsScreen.tsx`, `BanqueSangFormScreen.tsx`

#### Écrans supplémentaires à exploiter
- `BloodDonationRequestScreen.tsx` — Demande de don
- `BloodDonationMatchesScreen.tsx` — Matching donneur/receveur

#### Plan d'amélioration
1. **Demande d'urgence** — Bouton "🩸 Besoin urgent de sang" → formulaire groupe sanguin + localisation → notification aux donneurs proches
2. **Matching automatique** — Si l'utilisateur a renseigné son groupe sanguin, proposer les demandes compatibles
3. **Historique de dons** — Suivi des dons effectués
4. **Rappels de don** — Notification tous les 3 mois "Vous pouvez donner à nouveau"

---

## 🚗 2. TRANSPORT

### 2.1 TaxiHomeScreen

**Fichier**: `mobile/src/screens/specialized/TaxiHomeScreen.tsx` (1553 lignes)  
**Service mobile**: `taxiService.ts`

#### Backend disponible mais NON EXPLOITÉ
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `GET /api/taxis/search` | Recherche taxis | ✅ OUI |
| `POST /api/taxis` | Créer taxi | ✅ OUI |
| `GET /api/taxis/{id}` | Détails taxi | ✅ OUI |
| `GET /api/taxis` | Mes taxis | ✅ OUI |
| `POST /api/taxi/demand-prediction` | Prédiction demande IA | ❌ NON |
| `POST /api/taxi/optimize-route` | Optimisation route IA | ❌ NON |
| `GET /api/taxi/personalized-recommendations` | Recommandations perso | ❌ NON |

#### Problèmes UX critiques
1. **Pas d'estimation tarifaire** — L'utilisateur entre départ/destination mais ne voit JAMAIS le prix estimé avant de chercher
2. **Pas de suivi en temps réel** — `TaxiTrackingScreen.tsx` existe mais n'est pas intégré au parcours
3. **1553 lignes** — Fichier énorme avec modal de création intégré
4. **IA route/demande non utilisée** — Les endpoints `optimize-route` et `demand-prediction` existent mais ne sont pas appelés
5. **Pas de réservation directe** — `TaxiBookingScreen.tsx` existe mais le parcours n'est pas clair
6. **Contact chauffeur difficile** — Pas de bouton d'appel/WhatsApp rapide sur les résultats

#### Plan de refonte complète

##### A. Nouveau parcours Taxi (style Uber/Bolt)
```
[Carte avec position GPS] 
    ↓
[Saisie destination avec autocomplete]
    ↓
[Estimation prix + temps d'attente]
    ↓
[Liste taxis dispo triés par distance + prix]
    ↓
[Sélectionner taxi → Détails chauffeur + véhicule + avis]
    ↓
[📞 Appeler / 💬 WhatsApp / 📱 Réserver]
    ↓
[Suivi temps réel sur carte (TaxiTrackingScreen)]
    ↓
[Course terminée → Noter le chauffeur]
```

##### B. Nouvelles fonctionnalités écran principal
1. **Carte en haut** — Mini-carte avec position actuelle + taxis proches (points orange)
2. **Estimation automatique** — Dès que départ + destination sont remplis, afficher:
   - 💰 Prix estimé: "2,500 - 4,000 FCFA"
   - ⏱️ Temps d'attente estimé: "~5 min"
   - 📏 Distance: "12.3 km"
3. **Types de véhicule** — Filtres visuels: 🚗 Standard, 🚐 Familial, 🏎️ Confort, 🏍️ Moto
4. **Boutons d'action rapides** sur chaque taxi:
   - 📞 Appeler directement
   - 💬 WhatsApp
   - 📱 Réserver dans l'app
5. **Favoris chauffeurs** — Sauvegarder ses chauffeurs préférés
6. **Historique courses** — Dernières courses avec possibilité de re-réserver
7. **IA Optimisation route** — Utiliser `POST /api/taxi/optimize-route` pour afficher le meilleur itinéraire

##### C. Estimation tarifaire (NOUVEAU)
```typescript
// Calcul estimation côté client basé sur les tarifs du taxi
const estimatePrice = (taxi: Taxi, distanceKm: number): { min: number; max: number } => {
  const base = taxi.tarif_base || 500;
  const perKm = taxi.tarif_par_km || 250;
  const estimated = base + (perKm * distanceKm);
  return {
    min: Math.round(estimated * 0.85), // -15%
    max: Math.round(estimated * 1.15), // +15%
  };
};
```

---

### 2.2 CovoiturageHomeScreen

**Fichier**: `mobile/src/screens/specialized/CovoiturageHomeScreen.tsx` (1422 lignes)  
**Service mobile**: `covoiturageService.ts`

#### Backend disponible mais NON EXPLOITÉ
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `GET /api/covoiturages/search` | Recherche | ✅ OUI |
| `GET /api/covoiturages/nearby` | Proximité | ✅ OUI |
| `POST /api/covoiturages` | Créer trajet | ✅ OUI |
| `GET /api/covoiturages/{id}` | Détails | ✅ OUI |
| `GET /api/covoiturages/{id}/reviews` | Avis | ❌ NON affiché |
| `GET /api/covoiturages` | Mes covoiturages | ❌ NON accessible |

#### Problèmes UX
1. **Pas de réservation** — `CovoiturageBookingScreen.tsx` existe mais le parcours n'est pas fluide
2. **Pas d'avis affichés** — L'endpoint reviews existe mais les étoiles/avis ne sont pas affichés
3. **Pas de filtre par options** — Bagages, animaux, climatisation... les filtres existent dans le modèle mais pas dans l'UI de recherche
4. **Pas de notification** — Quand quelqu'un réserve une place, pas de notification
5. **Date picker basique** — Le sélecteur de date est minimal

#### Plan de refonte

##### A. Nouveau parcours Covoiturage (style BlaBlaCar)
```
[Recherche: Départ → Destination → Date]
    ↓
[Résultats avec: photo conducteur, prix, places dispo, avis ⭐]
    ↓
[Détail trajet: itinéraire, équipements, avis complets]
    ↓
[Réserver X place(s) → Paiement mobile money]
    ↓
[Confirmation + Contact conducteur]
    ↓
[Rappel J-1 + Point de rencontre]
```

##### B. Nouvelles fonctionnalités
1. **Filtres avancés** — Checkboxes: 🧳 Bagages, 🐕 Animaux, 🚬 Non-fumeur, ❄️ Climatisation
2. **Avis conducteur** — Étoiles + commentaires récents sur chaque résultat (utiliser `GET /api/covoiturages/{id}/reviews`)
3. **Carte d'itinéraire** — Visualiser le trajet sur une carte mini
4. **Places restantes** — Badge clair "2 places sur 4"
5. **Contact rapide** — 📞 Appeler / 💬 WhatsApp le conducteur
6. **Mes trajets** — Section accessible "🚗 Mes covoiturages" avec historique et trajets à venir
7. **Alertes trajet** — "Prévenez-moi quand un trajet Douala→Yaoundé est disponible le samedi"

---

## 🏠 3. IMMOBILIER

### 3.1 ImmobilierHomeScreen

**Fichier**: `mobile/src/screens/specialized/ImmobilierHomeScreen.tsx` (1307 lignes)  
**Service mobile**: `immobilierService.ts`

#### Backend disponible mais NON EXPLOITÉ
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `GET /api/immobilier/biens` | Recherche biens | ✅ OUI |
| `GET /api/immobilier/biens/{id}` | Détails | ✅ OUI |
| `POST /api/immobilier/biens/{id}/book-visit` | Réserver visite | ❌ NON sur HomeScreen |
| `POST /api/immobilier/biens/{id}/simulate-loan` | Simulation prêt | ❌ NON sur HomeScreen |
| `GET /api/immobilier/my-visits` | Mes visites | ❌ NON |
| `POST /api/immobilier/ai/recommendations` | Recommandations IA | ⚠️ CASSÉ |
| `POST /api/immobilier/ai/price-estimate` | Estimation prix IA | ⚠️ CASSÉ |
| `GET /api/immobilier/analytics` | Analytics | ❌ NON |
| `POST /api/immobilier/biens/{id}/favorite` | Favoris | ❌ NON sur HomeScreen |
| `GET /api/immobilier/my-favorites` | Mes favoris | ❌ NON |
| `POST /api/immobilier/compare` | Comparer biens | ❌ NON (écran existe) |
| `POST /api/immobilier/alerts` | Alertes prix | ❌ NON (écran existe) |
| `GET /api/immobilier/my-alerts` | Mes alertes | ❌ NON |
| `POST /api/immobilier/biens/{id}/track-view` | Tracking vues | ❌ NON |
| `POST /api/immobilier/biens/{id}/share` | Partager | ❌ NON |

#### Problèmes UX
1. **IA estimation prix cassée** — L'endpoint existe mais échoue
2. **IA recommandations cassée** — Idem
3. **Pas de favoris visibles** — Le bouton ❤️ n'est pas sur les cartes de résultats
4. **Pas de simulation prêt accessible** — L'endpoint existe mais pas de bouton
5. **Filtres basiques** — Pas de filtre par fourchette de prix (slider), par nombre de chambres
6. **Pas de carte** — Pour l'immobilier, une vue carte est essentielle
7. **Pas de comparaison** — `ImmobilierCompareScreen.tsx` existe mais n'est pas accessible
8. **Pas d'alertes prix** — `ImmobilierPriceAlertsScreen.tsx` existe mais n'est pas accessible

#### Plan de refonte

##### A. Nouveau parcours Immobilier (style Seloger/Zillow)
```
[Écran principal]
├── [🔍 Recherche avec filtres avancés]
│     ├── Type: Maison, Appart, Terrain, Bureau, Hôtel, Meublé
│     ├── Statut: Vente / Location
│     ├── Prix: Slider min-max
│     ├── Surface: Slider min-max
│     ├── Chambres: 1, 2, 3, 4, 5+
│     └── Standing: Économique → Luxe
├── [🗺️ Vue carte / 📋 Vue liste]
├── [❤️ Mes favoris]
├── [🔔 Mes alertes prix]
└── [🏦 Simulateur de prêt]

[Résultat] → [Détail bien]
              ├── [📸 Galerie photos plein écran]
              ├── [📍 Localisation sur carte]
              ├── [💰 Estimation IA du prix au m²]
              ├── [🏦 Simuler mon prêt]
              ├── [📅 Réserver une visite]
              ├── [⚖️ Comparer avec d'autres biens]
              ├── [🔔 Créer alerte si prix baisse]
              └── [📤 Partager]
```

##### B. Nouvelles fonctionnalités sur HomeScreen
1. **Toggle Carte/Liste** — Vue carte avec pins colorés (rouge = vente, bleu = location)
2. **Bouton ❤️ sur chaque carte** — Ajouter/retirer des favoris instantanément
3. **Prix slider** — Range slider pour prix min/max au lieu de TextInput
4. **"💡 Biens pour vous"** — Recommandations IA basées sur l'historique (avec fallback si IA cassée)
5. **Section "Mes actions"** — Boutons: "❤️ Favoris (3)", "🔔 Alertes (2)", "📅 Visites (1)"
6. **Estimation prix rapide** — Sur le détail, afficher "Prix estimé IA: X FCFA/m²" vs prix affiché
7. **Simulateur prêt intégré** — Slider pour apport + durée → mensualité calculée

##### C. Fix IA immobilier
```typescript
// Fallback pour estimation prix
const estimatePrice = async (property: RealEstateProperty) => {
  try {
    const response = await immobilierService.estimatePrice(
      property.type_bien, property.superficie_m2, ...
    );
    if (response.success) return response.estimate;
  } catch {}
  
  // Fallback: Calcul local basé sur les moyennes
  return localPriceEstimate(property);
};

const localPriceEstimate = (property: RealEstateProperty): PriceEstimate => {
  // Prix moyen au m² par ville camerounaise (données locales)
  const avgPricePerM2: Record<string, number> = {
    'Douala': 150000, 'Yaoundé': 120000, 'Bafoussam': 80000,
    'Bamenda': 70000, 'Kribi': 100000, 'Limbe': 90000,
  };
  const basePrice = avgPricePerM2[property.ville || 'Douala'] || 100000;
  const standingMultiplier = { 'Luxe': 2.5, 'Haut standing': 1.8, 'Bon standing': 1.3, 'Standard': 1.0, 'Économique': 0.7 };
  // ... calcul
};
```

---

## 💼 4. OFFRES D'EMPLOI

### 4.1 OffresEmploiHomeScreen

**Fichier**: `mobile/src/screens/offres-emploi/OffresEmploiHomeScreen.tsx` (924 lignes)  
**Service mobile**: `offreEmploiService.ts`

#### Backend disponible mais NON EXPLOITÉ
| Endpoint Backend | Fonctionnalité | Utilisé ? |
|-----------------|----------------|-----------|
| `GET /api/offres-emploi/search` | Recherche offres | ✅ OUI |
| `GET /api/offres-emploi/{id}` | Détails offre | ✅ OUI |
| `POST /api/offres-emploi` | Créer offre | ✅ OUI |
| `GET /api/offres-emploi` | Mes offres | ❌ NON sur HomeScreen |
| `GET /api/offres-emploi/matching/offres` | Matching IA | ⚠️ CASSÉ |
| `POST /api/offres-emploi/candidatures` | Postuler | ✅ OUI |
| `GET /api/offres-emploi/mes-candidatures` | Mes candidatures | ❌ NON sur HomeScreen |
| `POST /api/offres-emploi/ai/analyze-cv` | Analyse CV IA | ⚠️ CASSÉ |
| `GET /api/offres-emploi/ai/salary-prediction` | Prédiction salaire IA | ⚠️ CASSÉ |
| `POST /api/offres-emploi/ai/suggest-formations` | Suggestions formations IA | ⚠️ CASSÉ |
| `POST /api/offres-emploi/ai/matching` | Matching IA avancé | ⚠️ CASSÉ |
| `GET /api/offres-emploi/dashboard/candidat` | Dashboard candidat | ❌ NON |
| `GET /api/offres-emploi/dashboard/employeur` | Dashboard employeur | ❌ NON |
| `POST /api/ia/creation-offre-emploi` | Création offre IA | ❌ NON |

#### Problèmes UX critiques
1. **TOUTES les fonctionnalités IA cassées** — Analyse CV, prédiction salaire, suggestions formations, matching
2. **Pas de dashboard candidat** — L'endpoint existe mais aucun écran ne l'utilise
3. **Pas de suivi candidatures** — L'utilisateur postule mais ne peut pas voir l'état de ses candidatures depuis le HomeScreen
4. **Navigation vers écrans IA** — Les boutons "Analyser CV", "Salaire IA", "Formations" naviguent vers des écrans qui n'existent peut-être pas (`AICVAnalysis`, `AISalaryPrediction`, `AISuggestFormations`)
5. **Pas de filtres avancés** — Secteur, type contrat, salaire, remote... tout est absent
6. **Recherche textuelle uniquement** — Pas de filtres visuels

#### Plan de refonte complète

##### A. Double parcours: Candidat vs Employeur
```
[Accueil Emploi]
├── 🧑‍💼 MODE CANDIDAT
│   ├── [🔍 Recherche offres avec filtres avancés]
│   │     ├── Secteur: Tech, Santé, Finance, Commerce...
│   │     ├── Type: CDI, CDD, Stage, Freelance, Intérim
│   │     ├── Salaire: Slider min-max
│   │     ├── Remote: Oui / Non / Partiel
│   │     └── Expérience: Junior, Confirmé, Senior
│   ├── [📊 Mon Dashboard]
│   │     ├── Candidatures envoyées: 5
│   │     ├── En attente: 3
│   │     ├── Entretiens: 1
│   │     └── Offres recommandées: 8
│   ├── [📄 Mon CV + Profil]
│   ├── [🤖 IA Emploi]
│   │     ├── Analyser mon CV → Score + Améliorations
│   │     ├── Prédire mon salaire → Fourchette estimée
│   │     └── Formations recommandées → Upskilling
│   └── [📋 Mes candidatures]
│
└── 🏢 MODE EMPLOYEUR
    ├── [➕ Publier une offre (avec IA)]
    ├── [📊 Dashboard employeur]
    │     ├── Offres actives: 3
    │     ├── Candidatures reçues: 12
    │     └── Vues: 450
    └── [📋 Gérer mes offres]
```

##### B. Nouvelles fonctionnalités
1. **Filtres avancés visibles** — Chips horizontaux: CDI, CDD, Stage, Remote, + filtre salaire
2. **Dashboard candidat en haut** — Mini-résumé: "📬 3 candidatures • ⭐ 8 offres recommandées"
3. **Score de matching** sur chaque offre — "87% compatible avec votre profil"
4. **Bouton "Postuler en 1 clic"** — Si profil complété, postuler sans re-saisir
5. **Section "🤖 IA Emploi"** — 3 boutons IA bien visibles avec fallback robuste
6. **Alertes emploi** — "Prévenez-moi pour: Développeur, CDI, Douala, >500k FCFA"

##### C. Fix IA Emploi — Fallback complet
```typescript
// Analyse CV avec fallback
const analyzeCV = async (cvUrl: string) => {
  try {
    const response = await offreEmploiService.analyzeCV(cvUrl);
    if (response.success) return response.analysis;
  } catch {}
  
  // Fallback: Utiliser /api/ai/chat pour analyse basique
  const aiResponse = await apiPost('/api/ai/chat', {
    message: `Analyse ce CV et donne un score, points forts, points faibles: ${cvUrl}`,
    context: 'emploi_cv_analysis'
  });
  return parseCVAnalysisFromChat(aiResponse);
};

// Prédiction salaire avec fallback local
const predictSalary = async (params: SalaryParams) => {
  try {
    const response = await offreEmploiService.predictSalary(...);
    if (response.success) return response.prediction;
  } catch {}
  
  // Fallback: Grille salariale locale
  return localSalaryPrediction(params);
};

const localSalaryPrediction = (params: SalaryParams): SalaryPrediction => {
  // Grilles salariales camerounaises par secteur
  const salaryGrids: Record<string, { junior: number; confirme: number; senior: number }> = {
    'technologie': { junior: 250000, confirme: 500000, senior: 900000 },
    'finance': { junior: 200000, confirme: 450000, senior: 800000 },
    'sante': { junior: 180000, confirme: 400000, senior: 700000 },
    // ...
  };
  // Calcul basé sur expérience + secteur + ville
};
```

---

## 🔧 5. PROBLÈMES TRANSVERSAUX ET CORRECTIONS

### 5.1 IA Cassée — Stratégie de fallback globale

**Problème racine**: Les endpoints IA (`/api/pharmacies/ai/*`, `/api/hopitaux/ai/*`, `/api/offres-emploi/ai/*`, `/api/immobilier/ai/*`) appellent OpenAI via le backend, mais la clé API n'est pas configurée ou le service est down.

**Solution en 3 niveaux**:

```
Niveau 1: Appel IA backend normal
    ↓ (échoue)
Niveau 2: Appel /api/ai/chat (endpoint centralisé avec sa propre gestion d'erreur)
    ↓ (échoue)
Niveau 3: Réponses pré-calculées locales (données statiques camerounaises)
```

**Créer un hook React partagé**: `useAIWithFallback.ts`
```typescript
export const useAIWithFallback = () => {
  const askWithFallback = async (
    primaryCall: () => Promise<any>,
    chatContext: string,
    chatPrompt: string,
    localFallback: () => any
  ) => {
    // Niveau 1
    try {
      const result = await primaryCall();
      if (result?.success) return { source: 'ai', data: result };
    } catch {}
    
    // Niveau 2
    try {
      const chatResult = await apiPost('/api/ai/chat', {
        message: chatPrompt,
        context: chatContext,
        fallback: true
      });
      if (chatResult?.success) return { source: 'chat', data: chatResult };
    } catch {}
    
    // Niveau 3
    return { source: 'local', data: localFallback() };
  };
  
  return { askWithFallback };
};
```

### 5.2 Cohérence visuelle

**Problème**: Chaque service a son propre header, ses propres couleurs, ses propres patterns.

**Solution**: Créer des composants partagés:
- `SpecializedServiceHeader` — Header unifié avec back, titre, sous-titre, action
- `SearchWithFilters` — Barre de recherche + filtres chips
- `ResultCard` — Carte de résultat unifiée (titre, sous-titre, distance, prix, actions)
- `AISection` — Section IA avec état loading/erreur/résultat
- `EmptyState` — État vide unifié
- `QuickFilters` — Chips de filtres rapides horizontaux

### 5.3 Performance

**Problèmes**:
- Fichiers de 1500-2500 lignes → Découper en composants
- Tri côté client → Tri côté serveur
- Pas de cache → Utiliser le cache backend existant

### 5.4 Accessibilité
- Ajouter `accessibilityLabel` sur tous les boutons
- Contraste des textes sur gradients (certains textes blancs sur fond clair)
- Support du mode sombre

---

## 📋 6. ÉCRANS MANQUANTS À CRÉER

| Écran | Service | Priorité |
|-------|---------|----------|
| `TaxiPriceEstimateWidget` | Taxi | 🔴 P0 |
| `PharmacyOrderFlow` (panier + commande) | Pharmacie | 🔴 P0 |
| `EmploiDashboardCandidat` | Emploi | 🟠 P1 |
| `EmploiDashboardEmployeur` | Emploi | 🟠 P1 |
| `ImmobilierMapView` | Immobilier | 🟠 P1 |
| `ImmobilierLoanSimulator` | Immobilier | 🟡 P2 |
| `HopitalAppointmentScreen` | Hôpital | 🟡 P2 |
| `CovoituragePaymentScreen` | Covoiturage | 🟡 P2 |
| `BloodDonationUrgentRequest` | Banque de sang | 🟡 P2 |

---

## 🚀 7. PLAN D'EXÉCUTION

### Phase 1 — Fix critique (1-2 jours)
- [ ] Créer `useAIWithFallback.ts` — Hook partagé pour tous les services
- [ ] Corriger `PharmacieHomeScreen` — Intégrer vérification stock + commande
- [ ] Corriger `OffresEmploiHomeScreen` — Filtres avancés + dashboard candidat
- [ ] Fix navigation IA emploi (vérifier que les écrans cibles existent)

### Phase 2 — UX Transport (2-3 jours)
- [ ] Refonte `TaxiHomeScreen` — Estimation tarifaire + carte + boutons contact
- [ ] Refonte `CovoiturageHomeScreen` — Filtres + avis + réservation
- [ ] Intégrer `TaxiTrackingScreen` dans le parcours

### Phase 3 — UX Immobilier (2 jours)
- [ ] Ajouter favoris ❤️ sur les cartes
- [ ] Vue carte avec MapView
- [ ] Intégrer simulation prêt
- [ ] Intégrer comparaison et alertes prix

### Phase 4 — UX Santé avancé (2 jours)
- [ ] Refonte `HealthServicesHubScreen` — Urgences + pharmacie de garde dynamique
- [ ] Parcours commande pharmacie complet
- [ ] Système RDV hôpital
- [ ] Matching don de sang

### Phase 5 — Polish (1 jour)
- [ ] Composants partagés (`SpecializedServiceHeader`, `ResultCard`, etc.)
- [ ] Tests de tous les parcours
- [ ] Accessibilité

---

## 📱 RÉSUMÉ DES ÉCRANS EXISTANTS PAR SERVICE

### Santé
| Écran | Fichier | État |
|-------|---------|------|
| Hub Santé | `HealthServicesHubScreen.tsx` | 🟡 Basique |
| Pharmacie Home | `PharmacieHomeScreen.tsx` | 🟠 IA cassée |
| Pharmacie Search | `PharmacieSearchScreen.tsx` | ✅ OK |
| Pharmacie List | `PharmacieListScreen.tsx` | ✅ OK |
| Pharmacie Details | `PharmacieDetailsScreen.tsx` | 🟡 Basique |
| Pharmacie Form | `PharmacieFormScreen.tsx` | ✅ OK |
| Pharmacy Orders | `MyPharmacyOrdersScreen.tsx` | ✅ OK |
| Pharmacy AI | `PharmacyAIInteractionsScreen.tsx` | 🔴 Cassé |
| Pharmacy Analytics | `PharmacyAnalyticsScreen.tsx` | 🟡 Basique |
| Hôpital Home | `HopitalHomeScreen.tsx` | 🟠 IA cassée |
| Hôpital Search | `HopitalSearchScreen.tsx` | ✅ OK |
| Hôpital List | `HopitalListScreen.tsx` | ✅ OK |
| Hôpital Details | `HopitalDetailsScreen.tsx` | 🟡 Basique |
| Hôpital AI Reco | `HospitalAIRecommendationsScreen.tsx` | 🔴 Cassé |
| Hospital Analytics | `HospitalAnalyticsScreen.tsx` | 🟡 Basique |
| Banque Sang Search | `BanqueSangSearchScreen.tsx` | ✅ OK |
| Banque Sang List | `BanqueSangListScreen.tsx` | ✅ OK |
| Banque Sang Details | `BanqueSangDetailsScreen.tsx` | 🟡 Basique |
| Blood Donation | `BloodDonationRequestScreen.tsx` | ✅ OK |
| Blood Matches | `BloodDonationMatchesScreen.tsx` | 🟡 Basique |

### Transport
| Écran | Fichier | État |
|-------|---------|------|
| Taxi Home | `TaxiHomeScreen.tsx` | 🟠 Incomplet |
| Taxi Search | `TaxiSearchScreen.tsx` | ✅ OK |
| Taxi List | `TaxiListScreen.tsx` | ✅ OK |
| Taxi Details | `TaxiDetailsScreen.tsx` | 🟡 Basique |
| Taxi Booking | `TaxiBookingScreen.tsx` | 🟡 Non intégré |
| Taxi Tracking | `TaxiTrackingScreen.tsx` | 🟡 Non intégré |
| Taxi Availability | `TaxiAvailabilityScreen.tsx` | ✅ OK |
| Taxi AI Search | `TaxiIntelligentSearchScreen.tsx` | 🔴 Cassé |
| Taxi Form | `TaxiFormScreen.tsx` | ✅ OK |
| Mes Taxis | `MesTaxisScreen.tsx` | ✅ OK |
| Covoiturage Home | `CovoiturageHomeScreen.tsx` | 🟠 Incomplet |
| Covoiturage Search | `CovoiturageSearchScreen.tsx` | ✅ OK |
| Covoiturage List | `CovoiturageListScreen.tsx` | ✅ OK |
| Covoiturage Details | `CovoiturageDetailsScreen.tsx` | 🟡 Basique |
| Covoiturage Booking | `CovoiturageBookingScreen.tsx` | 🟡 Non intégré |
| Covoiturage AI Search | `CovoiturageIntelligentSearchScreen.tsx` | 🔴 Cassé |
| Covoiturage Form | `CovoiturageFormScreen.tsx` | ✅ OK |
| Mes Réservations | `MesReservationsCovoiturageScreen.tsx` | ✅ OK |

### Immobilier
| Écran | Fichier | État |
|-------|---------|------|
| Immobilier Home | `ImmobilierHomeScreen.tsx` | 🟠 IA cassée |
| Immobilier Search | `ImmobilierSearchScreen.tsx` | ✅ OK |
| Immobilier List | `ImmobilierListScreen.tsx` | ✅ OK |
| Immobilier Details | `ImmobilierDetailsScreen.tsx` | 🟡 Basique |
| Immobilier Booking | `ImmobilierBookingScreen.tsx` | 🟡 Non intégré |
| Immobilier Compare | `ImmobilierCompareScreen.tsx` | 🟡 Non intégré |
| Immobilier Alerts | `ImmobilierPriceAlertsScreen.tsx` | 🟡 Non intégré |
| Immobilier Form | `ImmobilierFormScreen.tsx` | ✅ OK |

### Emploi
| Écran | Fichier | État |
|-------|---------|------|
| Emploi Home | `OffresEmploiHomeScreen.tsx` | 🟠 IA cassée |
| Emploi Hub | `OffresEmploiHubScreen.tsx` | 🟡 Basique |
| Emploi Form | `OffresEmploiFormScreen.tsx` | ✅ OK |

---

*Ce document sert de roadmap pour la refonte UX complète des services spécialisés Yukpo.*
