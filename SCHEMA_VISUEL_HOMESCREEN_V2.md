# 📱 Schéma Visuel HomeScreen V2 - Avec Regroupements Services Spécialisés

## 🎯 Vue d'ensemble

**12 services spécialisés** regroupés en **4 catégories** pour une meilleure UX.

---

## 📊 REGROUPEMENT DES 12 SERVICES SPÉCIALISÉS

### Catégorie 1: 🏥 SANTÉ (4 services)
1. 💊 **Pharmacie**
2. 🏥 **Hôpital / Clinique**
3. 🔬 **Laboratoire / Imagerie**
4. 🩸 **Banque de Sang**

### Catégorie 2: 🚗 TRANSPORT (3 services)
5. 🚕 **Taxi**
6. 🚗 **Covoiturage**
7. 🚌 **Agence de Voyage** (Bus, Billets)

### Catégorie 3: 🏠 IMMOBILIER (1 service)
8. 🏠 **Immobilier**

### Catégorie 4: 💼 ÉDUCATION & EMPLOI (3 services)
9. 🎓 **Orientation Scolaire**
10. 💼 **Offres d'Emploi**
11. 📚 **Bourse du Livre Scolaire**

### Catégorie 5: 🍽️ CUISINE & MENUS (1 service)
12. 🍽️ **Planification Menus** (Menus de la semaine, Recettes, Liste de courses)

---

## 🔄 DISTINCTION PRESTATAIRE vs CLIENT

### Vue PRESTATAIRE (Gestion)
**Écran:** `GestionServicesSpecialisesScreen`
- **Objectif:** Gérer ses propres services spécialisés
- **Actions:** Créer, modifier, activer/désactiver, voir statistiques
- **Navigation:** ProfileScreen → "Mes Services Spécialisés" → GestionServicesSpecialisesScreen

### Vue CLIENT (Recherche)
**Écran:** `SpecializedSearchScreen` + écrans de recherche spécifiques
- **Objectif:** Rechercher et trouver des services spécialisés
- **Actions:** Rechercher, filtrer, réserver, contacter
- **Navigation:** HomeScreen → Section Services Spécialisés → Recherche

---

## 📐 STRUCTURE PROPOSÉE - HomeScreen

```
┌─────────────────────────────────────────────────────────────┐
│  🏠 YUKPOMNANG                                    🔔 👤      │ ← Header
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍 Rechercher un service ou créer...        📍    │   │ ← Recherche
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ╔═══════════════════════════════════════════════════════╗   │
│  ║  🏥 SERVICES SPÉCIALISÉS                             ║   │ ← NOUVEAU
│  ║  Accès rapide à vos services                          ║   │
│  ╠═══════════════════════════════════════════════════════╣   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  🏥 SANTÉ                                       │   ║   │ ← Catégorie 1
│  ║  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │   ║   │
│  ║  │  │ 💊  │  │ 🏥   │  │ 🔬  │  │ 🩸  │       │   ║   │
│  ║  │  │Pharm│  │Hôpit │  │Labo │  │Sang │       │   ║   │
│  ║  │  └──────┘  └──────┘  └──────┘  └──────┘       │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  🚗 TRANSPORT                                  │   ║   │ ← Catégorie 2
│  ║  │  ┌──────┐  ┌──────┐  ┌──────┐                 │   ║   │
│  ║  │  │ 🚕  │  │ 🚗  │  │ 🚌  │                 │   ║   │
│  ║  │  │Taxi │  │Covoit│  │Agence│                 │   ║   │
│  ║  │  └──────┘  └──────┘  └──────┘                 │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  🏠 IMMOBILIER                                 │   ║   │ ← Catégorie 3
│  ║  │  ┌──────┐                                      │   ║   │
│  ║  │  │ 🏠  │                                      │   ║   │
│  ║  │  │Immob│                                      │   ║   │
│  ║  │  └──────┘                                      │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  💼 ÉDUCATION & EMPLOI                        │   ║   │ ← Catégorie 4
│  ║  │  ┌──────┐  ┌──────┐  ┌──────┐               │   ║   │
│  ║  │  │ 🎓  │  │ 💼  │  │ 📚  │               │   ║   │
│  ║  │  │Orient│  │Emploi│  │Livres│               │   ║   │
│  ║  │  └──────┘  └──────┘  └──────┘               │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  🍽️ CUISINE & MENUS                           │   ║   │ ← Catégorie 5
│  ║  │  ┌──────┐                                      │   ║   │
│  ║  │  │ 🍽️  │                                      │   ║   │
│  ║  │  │Menus │                                      │   ║   │
│  ║  │  └──────┘                                      │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ║                                                       ║   │
│  ║  ┌───────────────────────────────────────────────┐   ║   │
│  ║  │  [👁️ Voir tous les services spécialisés →]   │   ║   │
│  ║  └───────────────────────────────────────────────┘   ║   │
│  ╚═══════════════════════════════════════════════════════╝   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📦 Produits et services recommandés                 │   │ ← Carousel
│  │  [Auto-scroll horizontal]                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎉 Promotions en cours                             │   │ ← Promos
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍 Découvrir plus                                  │   │ ← Feed
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 DESIGN PAR CATÉGORIE

### Catégorie 1: 🏥 SANTÉ
```
┌─────────────────────────────────────────────┐
│  🏥 SANTÉ                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ 💊  │  │ 🏥   │  │ 🔬  │  │ 🩸  │   │
│  │Pharm│  │Hôpit │  │Labo │  │Sang │   │
│  │     │  │     │  │     │  │     │   │
│  │[Badge] [Badge] [Badge] [Badge]        │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
└─────────────────────────────────────────────┘

Couleur: #10B981 (vert santé)
Badges: Nombre de services, "Nouveau", notifications
```

### Catégorie 2: 🚗 TRANSPORT
```
┌─────────────────────────────────────────────┐
│  🚗 TRANSPORT                               │
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ 🚕  │  │ 🚗  │  │ 🚌  │             │
│  │Taxi │  │Covoit│  │Agence│             │
│  │     │  │     │  │     │             │
│  │[Badge] [Badge] [Badge]                 │
│  └──────┘  └──────┘  └──────┘             │
└─────────────────────────────────────────────┘

Couleur: #3B82F6 (bleu transport)
Badges: Disponibilité, "En ligne", nombre de trajets
```

### Catégorie 3: 🏠 IMMOBILIER
```
┌─────────────────────────────────────────────┐
│  🏠 IMMOBILIER                              │
│  ┌──────┐                                    │
│  │ 🏠  │                                    │
│  │Immob│                                    │
│  │     │                                    │
│  │[Badge]                                   │
│  └──────┘                                    │
└─────────────────────────────────────────────┘

Couleur: #F59E0B (orange immobilier)
Badges: "Nouveau", nombre d'annonces, "Populaire"
```

### Catégorie 4: 💼 ÉDUCATION & EMPLOI
```
┌─────────────────────────────────────────────┐
│  💼 ÉDUCATION & EMPLOI                      │
│  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │ 🎓  │  │ 💼  │  │ 📚  │              │
│  │Orient│  │Emploi│  │Livres│              │
│  │     │  │     │  │     │              │
│  │[Badge] [Badge] [Badge]                  │
│  └──────┘  └──────┘  └──────┘              │
└─────────────────────────────────────────────┘

Couleur: #8B5CF6 (violet éducation)
Badges: "Nouveau", nombre d'offres, "Urgent"
```

### Catégorie 5: 🍽️ CUISINE & MENUS
```
┌─────────────────────────────────────────────┐
│  🍽️ CUISINE & MENUS                        │
│  ┌──────┐                                    │
│  │ 🍽️  │                                    │
│  │Menus │                                    │
│  │     │                                    │
│  │[Badge]                                   │
│  └──────┘                                    │
└─────────────────────────────────────────────┘

Couleur: #EC4899 (rose cuisine)
Badges: "Nouveau", menus actifs, "Populaire"
Description: Planification des repas, recettes, listes de courses
```

---

## 🔄 COMPORTEMENT PAR TYPE D'UTILISATEUR - NAVIGATION DÉTAILLÉE

### 🎯 PRESTATAIRE (gère ses services spécialisés)

**Détection automatique:** L'app vérifie si l'utilisateur a des services spécialisés

#### Scénario 1: Prestataire avec services existants

```
HomeScreen
  ↓
  Tap sur catégorie "🏥 SANTÉ"
    ↓
  [Détection: Utilisateur a des services santé]
    ↓
  GestionServicesSpecialisesScreen
    - Filtre automatique: category='sante'
    - Liste de SES services (Pharmacie, Hôpital, etc.)
    - Actions: Modifier, Activer/Désactiver, Statistiques
      ↓
    Tap sur "💊 Pharmacie" (son service)
      ↓
    PharmacieFormScreen (mode ÉDITION)
      - Pré-rempli avec ses données
      - Modifier horaires, médicaments, etc.
```

#### Scénario 2: Prestataire sans services dans cette catégorie

```
HomeScreen
  ↓
  Tap sur catégorie "🏥 SANTÉ"
    ↓
  [Détection: Utilisateur n'a PAS de services santé]
    ↓
  Modal de choix:
    ┌─────────────────────────────┐
    │  Créer un service santé     │
    │                             │
    │  [➕ Créer Pharmacie]       │
    │  [➕ Créer Hôpital]         │
    │  [➕ Créer Laboratoire]     │
    │  [➕ Créer Banque Sang]    │
    │                             │
    │  [🔍 Rechercher services]  │
    └─────────────────────────────┘
      ↓
    Si "Créer":
      → PharmacieFormScreen (mode CRÉATION)
    Si "Rechercher":
      → PharmacieSearchScreen (vue client)
```

#### Scénario 3: Tap direct sur service spécifique

```
HomeScreen
  ↓
  Tap sur "💊 Pharmacie" (dans catégorie SANTÉ)
    ↓
  [Détection: Utilisateur a une pharmacie?]
    ↓
  Si OUI:
    → PharmacieFormScreen (mode ÉDITION)
  Si NON:
    → Modal: "Créer une pharmacie?" ou "Rechercher pharmacies?"
      → PharmacieFormScreen (création) OU PharmacieSearchScreen
```

---

### 👤 CLIENT (recherche de services)

**Détection automatique:** L'app détecte que l'utilisateur n'a pas de services spécialisés OU est en mode recherche

#### Scénario 1: Client recherche par catégorie

```
HomeScreen
  ↓
  Tap sur catégorie "🏥 SANTÉ"
    ↓
  [Détection: Utilisateur est CLIENT]
    ↓
  SpecializedSearchScreen
    - Type: 'sante'
    - Filtres pré-remplis (distance, horaires)
    - Liste des 4 services disponibles:
      • 💊 Pharmacie
      • 🏥 Hôpital
      • 🔬 Laboratoire
      • 🩸 Banque de Sang
      ↓
    Tap sur "💊 Pharmacie"
      ↓
    PharmacieSearchScreen
      - Barre de recherche
      - Filtres: Distance, Horaires, Médicaments
      - Liste des pharmacies disponibles
      - Carte avec localisation
        ↓
      Tap sur une pharmacie
        ↓
      PharmacieDetailsScreen
        - Informations complètes
        - Horaires, contact
        - Bouton "Appeler", "Réserver"
```

#### Scénario 2: Client recherche service spécifique

```
HomeScreen
  ↓
  Tap sur "💊 Pharmacie" (dans catégorie SANTÉ)
    ↓
  [Détection: Utilisateur est CLIENT]
    ↓
  PharmacieSearchScreen
    - Recherche directe de pharmacies
    - Filtres avancés
    - Résultats géolocalisés
```

---

## 🔍 LOGIQUE DE DÉTECTION

### Comment l'app détermine Prestataire vs Client?

```typescript
// Pseudo-code de détection
const detectUserType = async (userId, category) => {
  // 1. Vérifier si l'utilisateur a des services dans cette catégorie
  const userServices = await apiGet(`/api/specialized-services/user?category=${category}`);
  
  if (userServices.length > 0) {
    // PRESTATAIRE avec services
    return {
      type: 'provider',
      hasServices: true,
      services: userServices,
      action: 'manage' // Gérer ses services
    };
  } else {
    // CLIENT ou PRESTATAIRE sans services
    return {
      type: userServices.length === 0 ? 'client' : 'provider',
      hasServices: false,
      action: 'search' // Rechercher des services
    };
  }
};
```

### Comportement selon le type

| Type | A des services? | Action au tap catégorie | Action au tap service |
|------|------------------|------------------------|----------------------|
| **Prestataire** | ✅ OUI | GestionServicesSpecialisesScreen (filtré) | FormScreen (ÉDITION) |
| **Prestataire** | ❌ NON | Modal: Créer ou Rechercher | Modal: Créer ou Rechercher |
| **Client** | ❌ NON | SpecializedSearchScreen | SearchScreen spécifique |

---

## 📱 EXEMPLE VISUEL DE NAVIGATION

### Pour PRESTATAIRE avec services:

```
┌─────────────────────────────────┐
│  HomeScreen                      │
│  ┌───────────────────────────┐   │
│  │  🏥 SANTÉ                 │   │ ← Tap ici
│  │  💊 🏥 🔬 🩸              │   │
│  └───────────────────────────┘   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  GestionServicesSpecialisesScreen│
│  [Filtre: SANTÉ]                │
│  ┌───────────────────────────┐   │
│  │  💊 Ma Pharmacie          │   │ ← Ses services
│  │  🏥 Mon Hôpital           │   │
│  └───────────────────────────┘   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  PharmacieFormScreen            │
│  [Mode: ÉDITION]                │
│  - Modifier horaires             │
│  - Modifier médicaments          │
│  - Statistiques                  │
└─────────────────────────────────┘
```

### Pour CLIENT:

```
┌─────────────────────────────────┐
│  HomeScreen                      │
│  ┌───────────────────────────┐   │
│  │  🏥 SANTÉ                 │   │ ← Tap ici
│  │  💊 🏥 🔬 🩸              │   │
│  └───────────────────────────┘   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  SpecializedSearchScreen         │
│  [Type: SANTÉ]                  │
│  ┌───────────────────────────┐   │
│  │  💊 Rechercher Pharmacie  │   │ ← Options
│  │  🏥 Rechercher Hôpital    │   │
│  │  🔬 Rechercher Laboratoire│   │
│  │  🩸 Rechercher Banque Sang│   │
│  └───────────────────────────┘   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  PharmacieSearchScreen          │
│  - Liste pharmacies             │
│  - Filtres (distance, horaires) │
│  - Carte géolocalisée           │
└─────────────────────────────────┘
```

---

## 📱 VERSION COMPACTE (Alternative)

Si l'espace est limité, version avec catégories repliables:

```
┌─────────────────────────────────────────────┐
│  🏥 SERVICES SPÉCIALISÉS                   │
│  ┌─────────────────────────────────────┐   │
│  │  🏥 SANTÉ                    [▼]    │   │ ← Repliable
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐│   │
│  │  │ 💊  │ │ 🏥  │ │ 🔬 │ │ 🩸││   │
│  │  └──────┘ └──────┘ └──────┘ └────┘│   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  🚗 TRANSPORT                 [▶]   │   │ ← Replié
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  🏠 BIEN-ÊTRE                 [▶]   │   │ ← Replié
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  💼 ÉDUCATION & EMPLOI        [▶]   │   │ ← Replié
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Avantages:**
- ✅ Moins d'encombrement visuel
- ✅ Focus sur la catégorie principale (Santé)
- ✅ Possibilité d'étendre les autres catégories

---

## 🎯 AVANTAGES DU REGROUPEMENT

### 1. **Organisation Logique** ✅
- Services regroupés par domaine d'usage
- Facilite la navigation mentale
- Réduit la charge cognitive

### 2. **Scalabilité** ✅
- Facile d'ajouter de nouveaux services dans une catégorie
- Pas besoin de réorganiser toute la grille
- Expansion progressive possible

### 3. **Personnalisation** ✅
- Afficher d'abord les catégories avec services
- Masquer les catégories vides pour prestataires
- Prioriser selon l'historique utilisateur

### 4. **Performance** ✅
- Chargement par catégorie (lazy loading)
- Cache par catégorie
- Optimisation des requêtes API

---

## 🔄 NAVIGATION DÉTAILLÉE

### Scénario 1: Prestataire avec services

```
HomeScreen
  → Tap "🏥 SANTÉ"
    → GestionServicesSpecialisesScreen (filtre: sante)
      → Liste: Pharmacie, Hôpital, Laboratoire, Banque Sang
        → Tap "Pharmacie"
          → PharmacieFormScreen (édition)
```

### Scénario 2: Prestataire sans services

```
HomeScreen
  → Tap "🏥 SANTÉ"
    → Modal: "Créer un service" ou "Rechercher"
      → Si "Créer": PharmacieFormScreen (création)
      → Si "Rechercher": PharmacieSearchScreen
```

### Scénario 3: Client recherche

```
HomeScreen
  → Tap "🏥 SANTÉ"
    → SpecializedSearchScreen (type: sante)
      → Tap "💊 Pharmacie"
        → PharmacieSearchScreen
          → Liste pharmacies
            → Tap pharmacie
              → PharmacieDetailsScreen
```

---

## 📊 MÉTRIQUES DE SUCCÈS

### Avant (sans regroupement):
- ❌ 12 services en grille 3x4 (trop chargé)
- ❌ Pas de distinction prestataire/client
- ❌ Navigation: 4 clics minimum

### Après (avec regroupement):
- ✅ 5 catégories claires et logiques
- ✅ Distinction prestataire/client
- ✅ Navigation: 1-2 clics maximum
- ✅ Meilleure compréhension
- ✅ Scalable pour nouveaux services
- ✅ Bourse du Livre dans Éducation (cohérence)
- ✅ Cuisine & Menus à part (spécificité, nom plus parlant)

---

## 🎨 DESIGN SYSTEM PAR CATÉGORIE

### Couleurs
```typescript
const CATEGORY_COLORS = {
  sante: '#10B981',        // Vert santé
  transport: '#3B82F6',   // Bleu transport
  immobilier: '#F59E0B',  // Orange immobilier
  education: '#8B5CF6',   // Violet éducation
  menus: '#EC4899',       // Rose cuisine & menus
};
```

### Icônes
```typescript
const CATEGORY_ICONS = {
  sante: 'heart-pulse',      // Lucide
  transport: 'car-front',     // Lucide
  immobilier: 'home',        // Lucide
  education: 'graduation-cap', // Lucide
  menus: 'utensils-crossed', // Lucide
};
```

### Badges
```typescript
interface ServiceBadge {
  type: 'count' | 'new' | 'notification' | 'popular';
  value?: number;
  color?: string;
}
```

---

## ✅ IMPLÉMENTATION RECOMMANDÉE

### Phase 1: Structure de base
- [ ] Créer composant `SpecializedServicesSection`
- [ ] Implémenter 4 catégories avec regroupements
- [ ] Détecter type utilisateur (prestataire/client)

### Phase 2: Navigation
- [ ] Navigation prestataire → GestionServicesSpecialisesScreen
- [ ] Navigation client → SpecializedSearchScreen
- [ ] Gestion des cas (a/n'a pas de services)

### Phase 3: Personnalisation
- [ ] Afficher d'abord catégories avec services
- [ ] Masquer catégories vides (optionnel)
- [ ] Prioriser selon historique

### Phase 4: Optimisation
- [ ] Lazy loading par catégorie
- [ ] Cache par catégorie
- [ ] Analytics par catégorie

---

**Date de création:** 2025-01-28  
**Version:** 2.0 (avec regroupements)  
**Statut:** 📋 À implémenter

