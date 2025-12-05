# 📊 Diagramme Parcours Utilisateur - Yukpo

## 🎯 Parcours CLIENT

```
┌─────────────────────────────────────────────────────────┐
│                    DÉMARRAGE                            │
│              Login/Register → HomeScreen                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DÉCOUVERTE (Feed Vidéo)                     │
│  Onglet "Vidéos" → VideoFeedScreen                      │
│  ├─ Scroll vertical infini                             │
│  ├─ Recommandations personnalisées (ML)                │
│  ├─ Filtres vidéo ⭐ NOUVEAU                            │
│  └─ Hashtags et découverte                             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  INTERACTION                             │
│  VideoFeedScreen                                        │
│  ├─ Like, Save, Commenter                              │
│  ├─ Duet/Remix (enregistrement simple)                 │
│  ├─ Appliquer filtres ⭐ NOUVEAU                        │
│  └─ Partager                                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  CONVERSION                              │
│  Cliquer vidéo → ProductDetailScreen                   │
│  └─ Acheter/Contacter prestataire                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🏢 Parcours PRESTATAIRE

```
┌─────────────────────────────────────────────────────────┐
│                    DÉMARRAGE                            │
│              Login/Register → HomeScreen                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         GESTION PRODUITS/SERVICES                        │
│  Onglet "Mes Services" → MesProduitsScreen              │
│  ├─ Ajouter/Modifier produits                           │
│  └─ Créer vidéo produit                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│      CRÉATION VIDÉO (Montage Avancé) ⭐ EXISTANT        │
│  Onglet "Créer" → VideoCreationWizardScreen             │
│  ├─ Sélection produits                                  │
│  ├─ Timeline editor (effets, transitions, musique)     │
│  ├─ Styles prédéfinis (TikTok, Story, Cinematic)       │
│  ├─ Génération IA                                      │
│  └─ Distribution multi-canaux                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DISTRIBUTION (Feed Vidéo)                   │
│  Vidéo publiée → Apparaît dans VideoFeedScreen          │
│  ├─ Découverte par utilisateurs                        │
│  ├─ Engagement (likes, saves, comments)                │
│  └─ Conversion vers produit                            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│         ANALYTICS CRÉATEUR ⭐ NOUVEAU                    │
│  ProfileScreen → CreatorAnalyticsScreen                  │
│  ├─ Overview (vues, likes, engagement)                  │
│  ├─ Top performers                                      │
│  ├─ Insights automatiques                              │
│  └─ Métriques détaillées par vidéo                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Complémentarité : Montage vs Feed

### Workflow Prestataire Complet

```
┌─────────────────┐
│  MONTAGE VIDÉO   │  ← Créer contenu professionnel
│  (Création)      │     (Timeline, effets, IA)
└────────┬─────────┘
         │
         ▼ Publier
┌─────────────────┐
│  FEED VIDÉO     │  ← Distribuer contenu
│  (Distribution) │     (Découverte, engagement)
└────────┬─────────┘
         │
         ▼ Mesurer
┌─────────────────┐
│   ANALYTICS     │  ← Optimiser contenu
│  (Mesure)       │     (Insights, métriques)
└─────────────────┘
```

### Workflow Client Complet

```
┌─────────────────┐
│  FEED VIDÉO     │  ← Découvrir contenu
│  (Découverte)   │     (Scroll, recommandations)
└────────┬─────────┘
         │
         ▼ Engager
┌─────────────────┐
│  INTERACTION     │  ← Like, comment, duet
│  (Engagement)    │     (Filtres, partage)
└────────┬─────────┘
         │
         ▼ Convertir
┌─────────────────┐
│  CONVERSION      │  ← Acheter/Contacter
│  (Achat)         │     (ProductDetailScreen)
└─────────────────┘
```

---

## 🎬 Différence : Montage vs Feed

| Aspect | Montage Vidéo (EXISTANT) | Feed Vidéo (NOUVEAU) |
|--------|-------------------------|---------------------|
| **Rôle** | Création professionnelle | Consommation/Découverte |
| **Complexité** | Élevée (timeline, effets, IA) | Simple (scroll, engagement) |
| **Usage** | Créer vidéos produits | Regarder vidéos |
| **Accès** | Onglet "Créer" | Onglet "Vidéos" |
| **Utilisateurs** | Principalement prestataires | Tous (clients + prestataires) |
| **Résultat** | Vidéo professionnelle | Découverte, engagement, conversion |

---

## 🔗 Intégration Précise

### 1. Du Montage vers Feed

**Automatique** :
```
VideoCreationWizardScreen
  └─> Vidéo générée
      └─> Publier
          └─> Apparaît automatiquement dans VideoFeedScreen
```

✅ **Déjà implémenté**

---

### 2. Du Feed vers Montage

**À implémenter** :
```
VideoFeedScreen
  └─> Voir vidéo produit
      └─> Bouton "Créer vidéo similaire"
          └─> VideoCreationWizardScreen (produit pré-sélectionné)
```

❌ **Pas encore implémenté** (bouton à ajouter)

---

### 3. Du Feed vers Analytics

**Partiellement implémenté** :
```
VideoFeedScreen
  └─> Prestataire voit sa vidéo
      └─> Clique profil
          └─> ProfileScreen
              └─> Menu "Analytics" (à ajouter)
                  └─> CreatorAnalyticsScreen
```

⚠️ **Analytics créé, mais menu dans ProfileScreen à ajouter**

---

## 📊 Ce que Yukpo Offre

### Avec le Feed Vidéo (NOUVEAU) :

1. **Découverte** :
   - Feed personnalisé style TikTok
   - Recommandations ML intelligentes
   - Découverte par hashtags
   - **Filtres vidéo** ⭐ NOUVEAU

2. **Engagement** :
   - Likes, saves, commentaires enrichis
   - Duet/Remix (création simple)
   - Partage social

3. **Conversion** :
   - CTA direct vers produits
   - Chat avec prestataire
   - Achat/Commande

### Avec le Montage Vidéo (EXISTANT) :

1. **Création** :
   - Timeline editor professionnel
   - Effets et transitions
   - Musique et audio
   - Génération IA

2. **Distribution** :
   - Multi-canaux (Chat, Produit, Shorts, Instagram, YouTube)
   - Styles prédéfinis

### Avec Analytics (NOUVEAU) :

1. **Mesure** :
   - Dashboard complet
   - Métriques détaillées
   - Insights automatiques
   - Optimisation contenu

---

## ✅ Complémentarité Finale

**Les deux systèmes sont complémentaires** :

- ✅ **Montage Vidéo** = Créer le contenu professionnel
- ✅ **Feed Vidéo** = Distribuer et consommer le contenu
- ✅ **Analytics** = Mesurer le succès

**Workflow** :
- Prestataire : Créer (Montage) → Distribuer (Feed) → Mesurer (Analytics)
- Client : Découvrir (Feed) → Engager → Convertir

---

*Date : 2025-12-03*  
*Diagramme complet des parcours*

