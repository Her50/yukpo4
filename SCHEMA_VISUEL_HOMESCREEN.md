# 📱 Schéma Visuel - HomeScreen Amélioré

## 🎯 Vue d'ensemble

Ce document présente le schéma visuel de la nouvelle organisation du HomeScreen pour une meilleure UX et accessibilité.

---

## 📐 STRUCTURE PROPOSÉE

```
┌─────────────────────────────────────────────────────────────┐
│  🏠 YUKPOMNANG                                    🔔 👤      │ ← Header (collapsible)
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🔍] Rechercher un service ou créer...        [📍] │   │ ← Zone de recherche
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🔍 Rechercher]  [➕ Créer]                        │   │ ← Sélecteur de mode
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ╔═══════════════════════════════════════════════════════╗   │
│  ║  🏥 SERVICES SPÉCIALISÉS                             ║   │ ← NOUVEAU: Section visible
│  ║  Accès rapide à vos services de santé et transport    ║   │
│  ╠═══════════════════════════════════════════════════════╣   │
│  ║  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   ║   │
│  ║  │ 💊   │  │ 🏥   │  │ 🧪   │  │ 🚑   │  │ 🚗   │   ║   │ ← Grille 3x2 (statique)
│  ║  │Pharma│  │Hôpit │  │Labo  │  │Taxi  │  │Covoit│   ║   │
│  ║  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   ║   │
│  ║  ┌──────┐  ┌──────┐  ┌──────┐                        ║   │
│  ║  │ 🚌   │  │ 🏠   │  │ 📚   │                        ║   │
│  ║  │Bus  │  │Immob │  │Livres│                        ║   │
│  ║  └──────┘  └──────┘  └──────┘                        ║   │
│  ║                                                       ║   │
│  ║  [👁️ Voir tous les services spécialisés →]         ║   │ ← Bouton "Voir tous"
│  ╚═══════════════════════════════════════════════════════╝   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📦 Produits et services recommandés                 │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │   │ ← Carousel auto-scroll
│  │  │ [1] │ │ [2] │ │ [3] │ │ [4] │ │ [5] │  ...     │   │   (pas de confusion)
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘          │   │
│  │  ● ○ ○ ○ ○                                        │   │ ← Pagination
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎉 Promotions en cours                             │   │ ← Promos globales
│  │  ┌─────┐ ┌─────┐ ┌─────┐                            │   │
│  │  │ -50%│ │ -30%│ │ -20%│                            │   │
│  │  └─────┘ └─────┘ └─────┘                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍 Découvrir plus                                  │   │ ← Infinite Feed
│  │  Explorer d'autres produits et services             │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  [Image]  Service 1                          │   │   │
│  │  │           Description...                     │   │   │
│  │  │           ⭐ 4.5  📍 2km  💰 5000 XAF       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  [Image]  Service 2                          │   │   │
│  │  │           Description...                     │   │   │
│  │  │           ⭐ 4.8  📍 5km  💰 3000 XAF       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ... (scroll infini)                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
│  🏠  📹  🛍️  📊  📋  👤                                    │ ← Bottom Tabs
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 DÉTAILS DES SECTIONS

### 1. Header (Collapsible) 📱

```
┌─────────────────────────────────────────────────────────────┐
│  🏠 YUKPOMNANG                                    🔔 👤      │
│  [Logo/Icon]                                        [Notif]  │
│                                                      [Profil]│
└─────────────────────────────────────────────────────────────┘
```

**Comportement:**
- Se réduit au scroll (header collapsible)
- Notifications: badge avec nombre
- Profil: photo ou initiales

---

### 2. Zone de Recherche 🔍

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍  Rechercher un service ou créer...        📍    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🔍 Rechercher]  [➕ Créer]                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Fonctionnalités:**
- Input de recherche avec autocomplete
- Bouton GPS pour localisation
- Sélecteur de mode (Rechercher / Créer)
- Support texte, image, audio, fichier

---

### 3. 🆕 SERVICES SPÉCIALISÉS (NOUVEAU) 🏥

```
╔═══════════════════════════════════════════════════════╗
║  🏥 SERVICES SPÉCIALISÉS                             ║
║  Accès rapide à vos services de santé et transport    ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐            ║
║  │   💊     │  │   🏥     │  │   🧪     │            ║
║  │          │  │          │  │          │            ║
║  │Pharmacie │  │ Hôpital  │  │Laboratoire│          ║
║  │          │  │          │  │          │            ║
║  │ [Badge]  │  │ [Badge]  │  │ [Badge]  │            ║
║  └──────────┘  └──────────┘  └──────────┘            ║
║                                                       ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐            ║
║  │   🚑     │  │   🚗     │  │   🚌     │            ║
║  │          │  │          │  │          │            ║
║  │  Taxi    │  │Covoiturage│ │   Bus    │            ║
║  │          │  │          │  │          │            ║
║  │ [Badge]  │  │ [Badge]  │  │ [Badge]  │            ║
║  └──────────┘  └──────────┘  └──────────┘            ║
║                                                       ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐            ║
║  │   🏠     │  │   📚     │  │   💼     │            ║
║  │          │  │          │  │          │            ║
║  │Immobilier│  │Livres    │  │  Emploi  │            ║
║  │          │  │          │  │          │            ║
║  │ [Badge]  │  │ [Badge]  │  │ [Badge]  │            ║
║  └──────────┘  └──────────┘  └──────────┘            ║
║                                                       ║
║  ┌───────────────────────────────────────────────┐   ║
║  │  👁️ Voir tous les services spécialisés →     │   ║
║  └───────────────────────────────────────────────┘   ║
╚═══════════════════════════════════════════════════════╝
```

**Caractéristiques:**
- **Grille 3 colonnes x 3 lignes** (statique, pas de scroll horizontal)
- **9 services principaux** visibles
- **Badges:** "Nouveau", nombre de services, notifications
- **Bouton "Voir tous":** Navigation vers hub complet
- **Design:** Cards avec ombre, hover effect
- **Couleurs:** Différentes par catégorie (santé: vert, transport: bleu, etc.)

**Services inclus:**
1. 💊 Pharmacie
2. 🏥 Hôpital
3. 🧪 Laboratoire
4. 🚑 Taxi
5. 🚗 Covoiturage
6. 🚌 Bus
7. 🏠 Immobilier
8. 📚 Livres scolaires
9. 💼 Offres d'emploi

---

### 4. Carousel Produits Recommandés 📦

```
┌─────────────────────────────────────────────────────────────┐
│  📦 Produits et services recommandés                         │
│                                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│  │ [1] │ │ [2] │ │ [3] │ │ [4] │ │ [5] │  ...               │
│  │     │ │     │ │     │ │     │ │     │                    │
│  │Image│ │Image│ │Image│ │Image│ │Image│                    │
│  │     │ │     │ │     │ │     │ │     │                    │
│  │Titre│ │Titre│ │Titre│ │Titre│ │Titre│                    │
│  │Prix │ │Prix │ │Prix │ │Prix │ │Prix │                    │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                               │
│  ● ○ ○ ○ ○  [Voir tous →]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Caractéristiques:**
- **Auto-scroll** (pausé au hover/touch)
- **Mix contenu:** Produits organiques + Publicités
- **Pagination:** Indicateurs visuels
- **Bouton "Voir tous":** Navigation vers résultats complets
- **⚠️ IMPORTANT:** Pas de confusion avec la section services spécialisés (design différent)

---

### 5. Promotions Globales 🎉

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Promotions en cours                                     │
│                                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐                                    │
│  │ -50%│ │ -30%│ │ -20%│                                    │
│  │     │ │     │ │     │                                    │
│  │Image│ │Image│ │Image│                                    │
│  │     │ │     │ │     │                                    │
│  │Titre│ │Titre│ │Titre│                                    │
│  │Promo│ │Promo│ │Promo│                                    │
│  └─────┘ └─────┘ └─────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

**Caractéristiques:**
- **3-5 promotions** en vedette
- **Design flashy:** Badges de réduction visibles
- **Navigation:** Tap pour voir détails

---

### 6. Infinite Feed 🔍

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Découvrir plus                                          │
│  Explorer d'autres produits et services                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Image]  Service 1                                  │   │
│  │           Description du service...                  │   │
│  │           ⭐ 4.5  📍 2km  💰 5000 XAF                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Image]  Service 2                                  │   │
│  │           Description du service...                  │   │
│  │           ⭐ 4.8  📍 5km  💰 3000 XAF                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ... (scroll infini avec pagination)                         │
└─────────────────────────────────────────────────────────────┘
```

**Caractéristiques:**
- **Scroll infini** avec pagination
- **Filtres:** Par catégorie, distance, prix
- **Métadonnées:** Note, distance, prix
- **Lazy loading:** Images chargées à la demande

---

## 🎨 DESIGN SYSTEM

### Couleurs par Section

```
Services Spécialisés:
  - Santé (Pharmacie, Hôpital, Labo): #10B981 (vert)
  - Transport (Taxi, Covoiturage, Bus): #3B82F6 (bleu)
  - Immobilier: #F59E0B (orange)
  - Livres: #8B5CF6 (violet)
  - Emploi: #EC4899 (rose)

Carousel Produits:
  - Fond: #FFFFFF
  - Bordure: #E5E7EB
  - Ombre: Subtile

Promotions:
  - Badge réduction: #EF4444 (rouge)
  - Fond: Gradient coloré
```

### Espacements

```
- Padding section: 16px
- Gap entre cards: 12px
- Margin bottom section: 24px
- Border radius cards: 12px
```

### Typographie

```
- Titre section: 18px, Bold
- Sous-titre: 14px, Regular
- Titre card: 16px, Semi-bold
- Description: 14px, Regular
- Prix: 16px, Bold
```

---

## 📱 RESPONSIVE DESIGN

### Portrait (Mobile)

```
┌─────────────────────┐
│  Header             │
│  Recherche          │
│  Services Spécialisés│
│  [3 colonnes]       │
│  Carousel           │
│  Promos             │
│  Feed               │
└─────────────────────┘
```

### Landscape (Tablette)

```
┌─────────────────────────────────────────┐
│  Header                                 │
│  Recherche                              │
│  Services Spécialisés [4 colonnes]      │
│  Carousel + Promos [côte à côte]       │
│  Feed                                   │
└─────────────────────────────────────────┘
```

---

## 🚀 INTERACTIONS

### Services Spécialisés

```
Tap sur card:
  → Si prestataire a des services: GestionServicesSpecialises
  → Si pas de services: Formulaire création (PharmacieForm, etc.)
  → Si nouveau service: Badge "Nouveau" visible

Tap sur "Voir tous":
  → SpecializedServicesHubScreen
```

### Carousel

```
Swipe horizontal: Navigation entre items
Tap: ProductDetailScreen
Auto-scroll: Pause au hover/touch
```

### Feed

```
Scroll vertical: Chargement automatique
Tap: ProductDetailScreen
Pull to refresh: Recharger contenu
```

---

## ✅ AVANTAGES DE CETTE ORGANISATION

1. **Services spécialisés visibles** dès l'arrivée sur HomeScreen
2. **Accès rapide** en 1-2 clics (au lieu de 4)
3. **Pas de confusion** avec carousel (design différent)
4. **Intuitif** pour les prestataires
5. **Moderne** et compétitif internationalement
6. **Responsive** pour tous les écrans

---

## 🔄 COMPARAISON AVANT/APRÈS

### AVANT ❌

```
HomeScreen
  → ProfileScreen (1 clic)
    → "Mes Services Spécialisés" (2 clics)
      → SpecializedServicesHubScreen (3 clics)
        → "Gérer mes services" (4 clics)
          → GestionServicesSpecialisesScreen
```

**Problèmes:**
- 4 clics pour accéder
- Services spécialisés invisibles
- Navigation complexe

### APRÈS ✅

```
HomeScreen
  → Section Services Spécialisés visible (0 clic)
    → Tap sur card (1 clic)
      → GestionServicesSpecialisesScreen
```

**Avantages:**
- 1 clic pour accéder
- Services spécialisés visibles
- Navigation intuitive

---

**Date de création:** 2025-01-28  
**Version:** 1.0  
**Statut:** 📋 À implémenter

