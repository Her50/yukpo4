# 🎯 Parcours Utilisateur - Système de Publicités Yukpomnang

## 📱 Vue d'ensemble

Le système de publicités de Yukpomnang offre un parcours utilisateur complet et intuitif, avec accès depuis **mobile** et **web**, rivalisant avec les grandes plateformes (Facebook Ads, TikTok Ads, Instagram Ads).

---

## 🚀 PARCOURS 1 : Création d'une Publicité

### **Mobile** (`CreatePubliciteScreen.tsx`)

#### **Point d'entrée :**
```
AppNavigator → MainStack → Tab "MesServices" → Bouton "Créer une publicité"
OU
AppNavigator → MainStack → Tab "Dashboard" → Carte "Publicités" → Bouton "+ Nouvelle publicité"
```

#### **Étapes du parcours :**

1. **Écran de création** (`CreatePubliciteScreen.tsx`)
   - **Composant** : `AdCreationStepper` (indicateur de progression)
   - **Étape 1 - Informations de base** :
     - Titre de la publicité (champ texte)
     - Description (textarea)
     - Sélection de produits (`selectedProduits` - multi-select)
   
   - **Étape 2 - Médias** :
     - Upload de vidéos (base64)
     - Génération de thumbnails automatique
     - Prévisualisation en temps réel (`AdPreviewCard`)
   
   - **Étape 3 - Budget et durée** :
     - Slider interactif (`BudgetSlider`)
     - Estimation de portée en temps réel
     - Sélection de la durée (jours)
     - Sélection de la zone géographique
   
   - **Étape 4 - Ciblage avancé** (`AdvancedTargeting`) :
     - Tranche d'âge (slider)
     - Genre (radio buttons)
     - Intérêts (multi-select avec suggestions IA)
     - Comportements (checkboxes)
     - Localisation (carte interactive)
   
   - **Étape 5 - A/B Testing** (`ABTestingVariants`) :
     - Création de variantes (titre, image, CTA)
     - Configuration de la répartition (50/50, 70/30, etc.)
   
   - **Étape 6 - Planification** (`CampaignScheduler`) :
     - Dates de début/fin
     - Heures de diffusion
     - Pauses (weekends, jours spécifiques)
   
   - **Étape 7 - Placements** (`PlacementSelector`) :
     - Feed principal
     - Stories
     - Recherche
     - Reels
     - Messages
     - Audience externe
   
   - **Étape 8 - Stratégie d'enchères** (`BidStrategySelector`) :
     - Auto
     - CPC (Coût par clic)
     - CPM (Coût par mille impressions)
     - CPA (Coût par acquisition)
   
   - **Étape 9 - Retargeting** (`RetargetingOptions`) :
     - Visiteurs du site
     - Utilisateurs ayant interagi
     - Clients existants
     - Audiences personnalisées

2. **Validation et soumission** :
   - Validation de tous les champs
   - Affichage des erreurs (`validationErrors`)
   - Appel API : `POST /api/publicites`
   - Redirection vers le dashboard avec message de succès

---

### **Web** (`CreatePublicitePage.tsx` - si existe)

#### **Point d'entrée :**
```
Navigation → "Publicités" → Bouton "Créer une publicité"
OU
Dashboard → Section "Publicités" → Bouton "+ Nouvelle publicité"
```

#### **Parcours similaire au mobile** mais avec :
- Interface plus large (meilleure utilisation de l'espace)
- Prévisualisation côte à côte
- Plus de détails visibles simultanément

---

## 📊 PARCOURS 2 : Dashboard et Analytics

### **Mobile** (`PubliciteDashboardScreen.tsx`)

#### **Point d'entrée :**
```
AppNavigator → MainStack → Tab "Dashboard" → Section "Publicités"
OU
AppNavigator → MainStack → Tab "MesServices" → "Mes Publicités"
```

#### **Sections du dashboard :**

1. **Statistiques globales** :
   - Total des vues
   - Total des clics
   - Taux de conversion
   - Budget total dépensé
   - Affichage en cartes (`NativeCard`)

2. **Résumé vidéo** :
   - Liste des publicités actives
   - Miniatures avec statistiques
   - Actions rapides (pause, modifier, voir détails)

3. **Analytics Avancés** (`AdvancedAnalyticsChart`) :
   - **Onglet "Tendances"** : Graphique temporel (vues, clics, conversions)
   - **Onglet "Campagnes"** : Comparaison des campagnes (barres)
   - **Onglet "Funnel"** : Funnel de conversion (barres de progression)
   - **Onglet "Placements"** : Performance par placement (camembert)
   - **Onglet "Ciblage"** : Performance par type de ciblage (barres)

4. **Suggestions d'Optimisation** (`OptimizationSuggestions`) :
   - Liste des campagnes avec suggestions
   - Score de performance
   - Niveau de risque
   - Actions : Appliquer / Ignorer

5. **Liste détaillée des publicités** :
   - Carte pour chaque publicité
   - Statistiques (vues, clics, CTR, conversion)
   - Actions : Voir détails, Modifier, Pause/Reprendre, Supprimer

---

### **Web** (`PubliciteDashboardPage.tsx`)

#### **Point d'entrée :**
```
Navigation → "Publicités" → "Dashboard"
```

#### **Parcours similaire au mobile** mais avec :
- Graphiques plus grands et interactifs (Recharts)
- Tableau de bord plus détaillé
- Export de données (CSV, JSON)
- Filtres avancés

---

## 🔔 PARCOURS 3 : Notifications et Alertes

### **Mobile**

#### **Point d'entrée :**
```
Notifications système → Alerte publicité
OU
AppNavigator → Tab "Notifications" → Filtre "Publicités"
```

#### **Types d'alertes :**

1. **Performance faible** :
   - Message : "⚠️ Votre publicité 'X' a un taux de conversion faible (0.5%)."
   - Action : Voir détails → Redirection vers dashboard

2. **CTR faible** :
   - Message : "📉 Votre publicité 'X' a un CTR faible (0.3%)."
   - Action : Optimiser → Redirection vers édition

3. **CPC élevé** :
   - Message : "💰 Votre publicité 'X' a un CPC élevé (250 FCFA)."
   - Action : Ajuster stratégie → Redirection vers édition

4. **Fin de campagne** :
   - Message : "⏰ Votre publicité 'X' se termine dans 2 jour(s)."
   - Action : Relancer → Redirection vers création

---

## 📜 PARCOURS 4 : Historique et Versioning

### **Mobile** (`PubliciteVersionHistory.tsx`)

#### **Point d'entrée :**
```
Dashboard → Sélectionner une publicité → "Historique"
OU
Édition d'une publicité → Bouton "Historique"
```

#### **Fonctionnalités :**

1. **Liste des versions** :
   - Affichage chronologique (plus récent en premier)
   - Badge de type de modification (Création, Modification, Pause, Reprise)
   - Date et heure de chaque version
   - Description du changement

2. **Actions disponibles** :
   - **Voir détails** : Afficher le snapshot complet de la version
   - **Restaurer** : Restaurer une version précédente
   - **Comparer** : Comparer deux versions (différences)

3. **Restauration** :
   - Confirmation avant restauration
   - Restauration automatique de tous les champs
   - Création d'une nouvelle version après restauration

---

### **Web** (`PubliciteVersionHistory.tsx`)

#### **Parcours similaire** avec :
- Interface plus détaillée
- Comparaison visuelle côte à côte
- Export de versions

---

## 🎨 PARCOURS 5 : Édition d'une Publicité

### **Mobile**

#### **Point d'entrée :**
```
Dashboard → Sélectionner une publicité → Bouton "Modifier"
```

#### **Étapes :**

1. **Chargement des données** :
   - Récupération de la publicité actuelle
   - Pré-remplissage de tous les champs
   - Affichage de la version actuelle

2. **Modification** :
   - Même interface que la création
   - Indicateur "Édition" en haut
   - Bouton "Annuler" pour revenir

3. **Sauvegarde** :
   - Validation
   - Appel API : `PUT /api/publicites/{id}`
   - Création automatique d'une nouvelle version
   - Message de succès

---

## 📤 PARCOURS 6 : Export/Import

### **Mobile**

#### **Export :**
```
Dashboard → Sélectionner une publicité → Menu "..." → "Exporter"
OU
Dashboard → Menu "..." → "Exporter toutes les campagnes"
```

#### **Import :**
```
Dashboard → Bouton "+" → "Importer depuis fichier"
→ Sélection du fichier JSON
→ Validation
→ Création de la publicité
```

---

## 🔍 PARCOURS 7 : Recherche et Filtres

### **Mobile**

#### **Point d'entrée :**
```
Dashboard → Barre de recherche en haut
```

#### **Filtres disponibles :**
- Par statut (active, paused, expired)
- Par date (créée, modifiée)
- Par performance (CTR, conversion)
- Par budget
- Par zone géographique

---

## 📈 PARCOURS 8 : Optimisation Automatique

### **Mobile**

#### **Point d'entrée :**
```
Dashboard → Section "Suggestions d'Optimisation"
```

#### **Fonctionnalités :**

1. **Analyse automatique** :
   - Analyse de toutes les campagnes actives
   - Calcul du score de performance
   - Identification des problèmes

2. **Suggestions** :
   - Budget (augmenter/réduire)
   - Ciblage (affiner)
   - Planification (ajuster les heures)
   - Placements (ajouter/retirer)
   - Stratégie d'enchères (changer)

3. **Actions** :
   - **Appliquer** : Application automatique de la suggestion
   - **Ignorer** : Masquer la suggestion
   - **Voir détails** : Explication détaillée

---

## 🗺️ Carte de Navigation Complète

```
┌─────────────────────────────────────────────────────────────┐
│                    APP NAVIGATOR                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─── AuthStack (si non connecté)
                              │
                              └─── MainStack (si connecté)
                                    │
                                    ├─── Tab "Home"
                                    │
                                    ├─── Tab "MesServices"
                                    │     │
                                    │     ├─── Liste des services
                                    │     │
                                    │     └─── Bouton "Créer publicité"
                                    │           └─── CreatePubliciteScreen
                                    │
                                    ├─── Tab "Dashboard"
                                    │     │
                                    │     ├─── PubliciteDashboardScreen
                                    │     │     ├─── Statistiques globales
                                    │     │     ├─── AdvancedAnalyticsChart
                                    │     │     ├─── OptimizationSuggestions
                                    │     │     └─── Liste des publicités
                                    │     │
                                    │     └─── Détails d'une publicité
                                    │           ├─── Statistiques détaillées
                                    │           ├─── PubliciteVersionHistory
                                    │           └─── Actions (Modifier, Pause, etc.)
                                    │
                                    ├─── Tab "Historique"
                                    │
                                    ├─── Tab "RechargeTokens"
                                    │
                                    ├─── Tab "MonCompte"
                                    │
                                    └─── Tab "Settings"
```

---

## 🔗 Endpoints API Utilisés

### **Création/Modification :**
- `POST /api/publicites` - Créer une publicité
- `PUT /api/publicites/{id}` - Modifier une publicité
- `DELETE /api/publicites/{id}` - Supprimer une publicité

### **Consultation :**
- `GET /api/publicites/dashboard` - Dashboard complet
- `GET /api/publicites/active` - Publicités actives
- `GET /api/publicites/{id}` - Détails d'une publicité

### **Analytics :**
- `GET /api/publicites/analytics/advanced` - Analytics avancés
- `GET /api/publicites/optimization/suggestions` - Suggestions d'optimisation
- `GET /api/publicites/{id}/optimize` - Analyse d'une campagne

### **Notifications :**
- `GET /api/publicites/alerts` - Récupérer les alertes
- `POST /api/publicites/alerts/check` - Déclencher vérification

### **Versioning :**
- `GET /api/publicites/{id}/versions` - Historique des versions
- `GET /api/publicites/{id}/versions/{version_number}` - Détails d'une version
- `POST /api/publicites/{id}/versions/{version_number}/restore` - Restaurer une version
- `GET /api/publicites/{id}/versions/{v1}/compare/{v2}` - Comparer deux versions

### **Export/Import :**
- `GET /api/publicites/{id}/export` - Exporter une campagne
- `GET /api/publicites/export/all` - Exporter toutes les campagnes
- `POST /api/publicites/import` - Importer une campagne

### **Tracking :**
- `POST /api/publicites/track-view` - Enregistrer une vue
- `POST /api/publicites/track-click` - Enregistrer un clic

---

## ✅ Conclusion

Le parcours utilisateur de Yukpomnang pour les publicités est **complet et intuitif**, avec :
- ✅ Création guidée en plusieurs étapes
- ✅ Dashboard avec analytics avancés
- ✅ Optimisation automatique
- ✅ Notifications temps réel
- ✅ Historique et versioning
- ✅ Export/Import
- ✅ Accès mobile et web

**Parité 100% avec les grandes plateformes !** 🎉

