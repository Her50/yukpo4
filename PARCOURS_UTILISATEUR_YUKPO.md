# 🗺️ Parcours Utilisateur Complet - Yukpo

## 📱 Structure de Navigation

### 1. **Navigation Principale (Bottom Tabs)**

L'application utilise un système de **Bottom Tabs** (onglets en bas) pour la navigation principale :

```
┌─────────────────────────────────────┐
│         CONTENU PRINCIPAL           │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
┌──────┬──────┬──────┬──────┬────────┐
│ Accueil │ Vidéos │ Créer │ Services│ Historique │
└──────┴──────┴──────┴──────┴────────┘
```

**Onglets disponibles** :
1. **Accueil** (`Home`) - Page d'accueil principale
2. **Vidéos** (`Videos`) - Feed vidéo (lecture/visualisation) ⭐ NOUVEAU
3. **Créer** (`Video`) - Création vidéo (montage) ⭐ EXISTANT
4. **Mes Services** (`Services`) - Gestion produits/services
5. **Historique** (`History`) - Historique des interactions

---

## 🎯 Parcours Utilisateur : CLIENT

### Parcours Principal Client

```
1. DÉMARRAGE
   └─> Login/Register
       └─> HomeScreen (Accueil)

2. DÉCOUVERTE DE CONTENU
   └─> HomeScreen
       ├─> Recherche services/produits
       ├─> Navigation catégories
       └─> Feed Vidéo (Onglet "Vidéos") ⭐ NOUVEAU
           ├─> Scroll vertical infini
           ├─> Likes, saves, commentaires
           ├─> Duet/Remix
           ├─> Filtres vidéo ⭐ NOUVEAU
           └─> Partage

3. INTERACTION AVEC CONTENU
   └─> VideoFeedScreen
       ├─> Cliquer sur vidéo produit
       │   └─> ProductDetailScreen (détails produit)
       ├─> Cliquer sur créateur
       │   └─> ProfileScreen (profil créateur)
       ├─> Cliquer sur hashtag
       │   └─> HashtagDiscoveryScreen (découverte par hashtag)
       └─> Créer duet/remix
           └─> DuetRemixModal (enregistrement)

4. CRÉATION DE CONTENU (Optionnel pour Client)
   └─> Onglet "Créer"
       └─> VideoCreationWizardScreen
           ├─> Sélection produits
           ├─> Configuration vidéo
           ├─> Timeline editor
           └─> Génération IA
```

**Points d'accès Feed Vidéo (Client)** :
- ✅ **Onglet "Vidéos"** dans la barre de navigation (principal)
- ✅ **Bouton dans HomeScreen** (si présent)
- ✅ **Deep link** depuis partage externe

---

## 🏢 Parcours Utilisateur : PRESTATAIRE

### Parcours Principal Prestataire

```
1. DÉMARRAGE
   └─> Login/Register
       └─> HomeScreen (Accueil)

2. GESTION PRODUITS/SERVICES
   └─> Onglet "Mes Services"
       └─> MesProduitsScreen / MesServicesScreen
           ├─> Ajouter produit
           ├─> Modifier produit
           ├─> Gérer médias
           └─> Créer vidéo produit ⭐ EXISTANT
               └─> ProductVideoCreationModal
                   └─> VideoCreationWizardScreen

3. CRÉATION VIDÉO PRODUIT (Montage Avancé) ⭐ EXISTANT
   └─> ProductVideoCreationModal
       └─> VideoCreationWizardScreen
           ├─> Sélection produits/services
           ├─> Configuration style (TikTok, Story, Cinematic, Carousel)
           ├─> Timeline editor (effets, transitions, musique)
           ├─> Génération IA
           └─> Distribution (Chat, Produit, Shorts, Instagram, YouTube)

4. ANALYTICS CRÉATEUR ⭐ NOUVEAU
   └─> ProfileScreen (profil prestataire)
       └─> CreatorAnalyticsScreen
           ├─> Overview (vues, likes, engagement)
           ├─> Top performers
           ├─> Insights automatiques
           └─> Métriques détaillées par vidéo

5. VISUALISATION FEED (Prestataire aussi)
   └─> Onglet "Vidéos"
       └─> VideoFeedScreen
           ├─> Voir ses propres vidéos
           ├─> Voir vidéos concurrents
           └─> Analyser performances
```

**Points d'accès Feed Vidéo (Prestataire)** :
- ✅ **Onglet "Vidéos"** (même que client)
- ✅ **Depuis analytics** (voir ses vidéos dans le feed)

---

## 🎬 Complémentarité : Feed Vidéo vs Montage Vidéo

### 📹 **Feed Vidéo** (VideoFeedScreen) - NOUVEAU

**Rôle** : **CONSOMMATION** de contenu vidéo

**Fonctionnalités** :
- ✅ Scroll vertical infini (style TikTok)
- ✅ Auto-play vidéos
- ✅ Engagement (likes, saves, comments, shares)
- ✅ Recommandations personnalisées (ML)
- ✅ Duet/Remix (enregistrement simple)
- ✅ Filtres vidéo en temps réel ⭐ NOUVEAU
- ✅ Hashtags et découverte
- ✅ Live streaming

**Usage** : Pour **regarder** et **découvrir** des vidéos

**Accès** : Onglet "Vidéos" dans la barre de navigation

---

### ✂️ **Montage Vidéo** (VideoCreationWizardScreen) - EXISTANT

**Rôle** : **CRÉATION** de contenu vidéo professionnel

**Fonctionnalités** :
- ✅ Sélection produits/services
- ✅ Timeline editor avancé
- ✅ Effets et transitions
- ✅ Musique et audio
- ✅ Styles prédéfinis (TikTok, Story, Cinematic, Carousel)
- ✅ Génération IA
- ✅ Distribution multi-canaux

**Usage** : Pour **créer** des vidéos produits marketing

**Accès** : 
- Onglet "Créer" dans la barre de navigation
- Depuis `ProductVideoCreationModal` (création vidéo produit)

---

## 🔄 Complémentarité Précise

### 1. **Workflow Complet Prestataire**

```
ÉTAPE 1 : CRÉATION (Montage Vidéo)
└─> VideoCreationWizardScreen
    ├─> Sélectionner produits
    ├─> Configurer style, effets, musique
    ├─> Générer vidéo avec IA
    └─> Publier vidéo

ÉTAPE 2 : DISTRIBUTION (Feed Vidéo)
└─> VideoFeedScreen
    ├─> La vidéo apparaît dans le feed
    ├─> Utilisateurs découvrent la vidéo
    ├─> Engagement (likes, saves, comments)
    └─> Conversion vers produit

ÉTAPE 3 : ANALYTICS (Dashboard Créateur)
└─> CreatorAnalyticsScreen
    ├─> Voir performances vidéo
    ├─> Analyser engagement
    └─> Optimiser prochaines vidéos
```

**Complémentarité** :
- ✅ **Montage Vidéo** = Créer le contenu
- ✅ **Feed Vidéo** = Distribuer le contenu
- ✅ **Analytics** = Mesurer le succès

---

### 2. **Workflow Client**

```
ÉTAPE 1 : DÉCOUVERTE (Feed Vidéo)
└─> VideoFeedScreen
    ├─> Scroll feed personnalisé
    ├─> Découvrir produits/services
    ├─> Appliquer filtres ⭐ NOUVEAU
    └─> Engager avec contenu

ÉTAPE 2 : INTERACTION
└─> VideoFeedScreen
    ├─> Like, save, commenter
    ├─> Créer duet/remix
    └─> Partager

ÉTAPE 3 : CONVERSION
└─> Cliquer sur vidéo produit
    └─> ProductDetailScreen
        └─> Acheter/Contacter prestataire
```

**Complémentarité** :
- ✅ **Feed Vidéo** = Découvrir et consommer
- ✅ **Duet/Remix** = Créer contenu simple (sans montage)
- ✅ **Montage Vidéo** = Optionnel (créer vidéo produit soi-même)

---

## 🎯 Points d'Accès Détaillés

### Feed Vidéo (VideoFeedScreen)

**Accès Principal** :
1. ✅ **Onglet "Vidéos"** (Bottom Tab) - Accès direct
2. ✅ **Deep link** : `yukpo://video-feed` ou `yukpo://videos`

**Accès Secondaire** :
- Depuis `HomeScreen` (si bouton présent)
- Depuis `HashtagDiscoveryScreen` (après clic hashtag)
- Depuis partage externe

---

### Montage Vidéo (VideoCreationWizardScreen)

**Accès Principal** :
1. ✅ **Onglet "Créer"** (Bottom Tab) - Accès direct
2. ✅ **Depuis `ProductVideoCreationModal`** - Création vidéo produit

**Accès Secondaire** :
- Depuis `MesProduitsScreen` (créer vidéo pour produit)
- Depuis `MesServicesScreen` (créer vidéo pour service)

---

### Analytics Créateur (CreatorAnalyticsScreen)

**Accès** :
1. ✅ **Depuis `ProfileScreen`** - Menu "Analytics" (à ajouter)
2. ✅ **Deep link** : `yukpo://creator-analytics`
3. ✅ **Navigation directe** : `navigation.navigate('CreatorAnalytics')`

---

## 🔗 Intégration entre Composants

### 1. **Du Feed vers Montage**

```
VideoFeedScreen
└─> Utilisateur voit vidéo produit
    └─> Clique "Créer vidéo similaire"
        └─> VideoCreationWizardScreen (avec produit pré-sélectionné)
```

**À implémenter** : Bouton "Créer vidéo similaire" dans VideoFeedScreen

---

### 2. **Du Montage vers Feed**

```
VideoCreationWizardScreen
└─> Vidéo générée et publiée
    └─> Automatiquement ajoutée au feed
        └─> Apparaît dans VideoFeedScreen
```

**Déjà implémenté** : Les vidéos créées apparaissent automatiquement dans le feed

---

### 3. **Du Feed vers Analytics**

```
VideoFeedScreen
└─> Prestataire voit sa vidéo
    └─> Clique sur profil
        └─> ProfileScreen
            └─> Menu "Analytics"
                └─> CreatorAnalyticsScreen
```

**À implémenter** : Menu "Analytics" dans ProfileScreen pour prestataires

---

## 📊 Résumé : Ce que Yukpo Offre

### Pour les **CLIENTS** :

1. **Découverte** :
   - ✅ Feed vidéo personnalisé (style TikTok)
   - ✅ Recommandations intelligentes
   - ✅ Découverte par hashtags
   - ✅ Filtres vidéo pour personnalisation ⭐ NOUVEAU

2. **Engagement** :
   - ✅ Likes, saves, commentaires enrichis
   - ✅ Duet/Remix (créer contenu simple)
   - ✅ Partage social

3. **Conversion** :
   - ✅ CTA direct vers produits
   - ✅ Chat avec prestataire
   - ✅ Achat/Commande

---

### Pour les **PRESTATAIRES** :

1. **Création** :
   - ✅ Montage vidéo professionnel (timeline, effets, IA)
   - ✅ Styles prédéfinis (TikTok, Story, Cinematic)
   - ✅ Distribution multi-canaux

2. **Distribution** :
   - ✅ Vidéos dans feed personnalisé
   - ✅ Découverte par hashtags
   - ✅ Recommandations ML

3. **Analytics** :
   - ✅ Dashboard complet ⭐ NOUVEAU
   - ✅ Métriques détaillées (vues, engagement, completion)
   - ✅ Insights automatiques
   - ✅ Top performers
   - ✅ Optimisation contenu

---

## ✅ Complémentarité Finale

### **Montage Vidéo** (Création)
- **Quand** : Pour créer des vidéos produits professionnelles
- **Où** : Onglet "Créer" ou depuis gestion produits
- **Qui** : Principalement prestataires (clients optionnel)

### **Feed Vidéo** (Consommation)
- **Quand** : Pour découvrir et regarder des vidéos
- **Où** : Onglet "Vidéos"
- **Qui** : Tous les utilisateurs (clients et prestataires)

### **Analytics** (Mesure)
- **Quand** : Pour analyser performances vidéos
- **Où** : Depuis profil prestataire
- **Qui** : Prestataires uniquement

---

## 🎯 Workflow Complet

```
PRESTATAIRE :
1. Créer vidéo (Montage) → 2. Publier → 3. Apparaît dans Feed → 4. Analytics

CLIENT :
1. Découvrir vidéo (Feed) → 2. Engager → 3. Convertir (achat/contact)
```

**Les deux systèmes sont complémentaires** :
- ✅ **Montage** = Créer le contenu
- ✅ **Feed** = Distribuer le contenu
- ✅ **Analytics** = Mesurer le succès

---

*Date : 2025-12-03*  
*Guide complet des parcours utilisateurs*

