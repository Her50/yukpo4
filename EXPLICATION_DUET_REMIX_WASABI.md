# 🎬 Explication : Duet/Remix et Rôle de Wasabi

## 🎯 Qu'est-ce que Duet/Remix ?

### Concept (Style TikTok)

**Duet** : Créer une vidéo côte à côte avec une vidéo existante
**Remix** : Réutiliser l'audio d'une vidéo existante pour créer une nouvelle vidéo

---

## 👥 Qui Utilise Duet/Remix ?

### 1. **CLIENTS** (Utilisateurs finaux) - Usage Principal

**Scénarios d'utilisation** :

#### Scénario 1 : Client voit vidéo produit et veut créer duet
```
Client dans VideoFeedScreen
  └─> Voit vidéo produit/service
      └─> Clique "Duet"
          └─> Enregistre sa réaction/vidéo côte à côte
              └─> Partage dans le feed
```

**Cas d'usage** :
- ✅ **Réaction** : Client réagit à une vidéo produit
- ✅ **Testimonial** : Client montre le produit en action
- ✅ **Review** : Client donne son avis sur le produit
- ✅ **Démo** : Client montre comment utiliser le produit

#### Scénario 2 : Client veut réutiliser l'audio (Remix)
```
Client dans VideoFeedScreen
  └─> Voit vidéo avec musique/audio intéressant
      └─> Clique "Remix"
          └─> Enregistre nouvelle vidéo avec même audio
              └─> Partage dans le feed
```

**Cas d'usage** :
- ✅ **Musique** : Réutiliser musique d'une vidéo
- ✅ **Narration** : Réutiliser narration/voix
- ✅ **Sound effect** : Réutiliser effet sonore

---

### 2. **PRESTATAIRES** (Optionnel)

**Scénarios d'utilisation** :

#### Scénario 1 : Prestataire répond à un duet client
```
Prestataire dans VideoFeedScreen
  └─> Voit duet créé par client
      └─> Clique "Duet" pour répondre
          └─> Enregistre réponse
              └─> Partage dans le feed
```

**Cas d'usage** :
- ✅ **Réponse** : Répondre à un duet client
- ✅ **Clarification** : Clarifier un point sur le produit
- ✅ **Engagement** : Engager avec communauté

---

## 🔄 Workflow Complet Duet/Remix

### Workflow Client (Usage Principal)

```
1. DÉCOUVERTE
   └─> VideoFeedScreen
       └─> Client voit vidéo produit/service

2. CRÉATION DUET/REMIX
   └─> Clique "Duet" ou "Remix"
       └─> DuetRemixModal s'ouvre
           ├─> Sélection type (audio ou side-by-side)
           └─> VideoRecorder s'ouvre
               └─> Client enregistre vidéo

3. UPLOAD
   └─> Vidéo enregistrée
       └─> Upload vers backend (multipart)
           └─> Backend upload vers Wasabi
               └─> URL Wasabi sauvegardée

4. PUBLICATION
   └─> Duet créé dans base de données
       └─> Apparaît dans feed
           └─> Autres utilisateurs voient le duet
```

---

## 📦 Rôle de Wasabi dans Duet/Remix

### 1. **Stockage Vidéo Duet/Remix**

**Workflow** :
```
1. Client enregistre vidéo duet
   └─> Vidéo locale (téléphone)

2. Upload vers backend
   └─> POST /api/duets/upload (multipart)
       └─> Backend reçoit vidéo

3. Backend upload vers Wasabi
   └─> Upload dans bucket "yukpo-video-prod"
       └─> URL Wasabi générée
           Exemple: https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/duets/duet_123.mp4

4. Sauvegarde en base
   └─> URL Wasabi sauvegardée dans table `media`
       └─> Metadata indique "is_duet: true"

5. Distribution
   └─> Vidéo apparaît dans feed
       └─> Lecture depuis Wasabi via CDN
```

---

### 2. **Pourquoi Wasabi pour Duet/Remix ?**

**Raisons** :

1. **Volume** :
   - ✅ Les duets/remix peuvent être nombreux (millions potentiellement)
   - ✅ Wasabi supporte stockage massif économique

2. **Performance** :
   - ✅ Optimisé pour streaming vidéo
   - ✅ Distribution via CDN pour latence minimale

3. **Coût** :
   - ✅ Économique pour stockage vidéo
   - ✅ Pas de frais de sortie élevés

4. **Intégration** :
   - ✅ Déjà configuré dans votre backend
   - ✅ Compatible avec système existant

---

### 3. **Extraction Audio (Remix)**

**Workflow Remix** :
```
1. Client sélectionne "Remix" (audio only)
   └─> Backend extrait audio de vidéo originale
       └─> Utilise FFmpeg pour extraction
           └─> Audio extrait (MP3/M4A)

2. Upload audio vers Wasabi
   └─> Audio stocké dans Wasabi
       └─> URL audio sauvegardée
           Exemple: https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/audio/audio_123.mp3

3. Client enregistre nouvelle vidéo
   └─> Upload vidéo vers Wasabi
       └─> Metadata indique "original_audio_url"

4. Distribution
   └─> Vidéo remix apparaît dans feed
       └─> Audio original disponible pour autres remix
```

**Rôle Wasabi** :
- ✅ Stocke audio extrait
- ✅ Stocke vidéo remix
- ✅ Distribution optimale via CDN

---

## 🎯 Cas d'Usage Concrets

### Cas 1 : Client Réagit à Vidéo Produit

**Scénario** :
```
1. Prestataire crée vidéo produit (Montage)
   └─> Vidéo publiée dans feed

2. Client voit vidéo dans feed
   └─> Aime le produit
       └─> Clique "Duet"
           └─> Enregistre vidéo montrant le produit
               └─> Partage duet dans feed

3. Résultat
   └─> Duet apparaît dans feed
       └─> Autres clients voient réaction
           └─> Augmente confiance et engagement
```

**Rôle Wasabi** : Stocke vidéo duet client

---

### Cas 2 : Client Crée Testimonial

**Scénario** :
```
1. Client achète produit
   └─> Satisfait du produit

2. Client crée duet
   └─> Montre produit en action
       └─> Partage testimonial dans feed

3. Résultat
   └─> Testimonial apparaît dans feed
       └─> Preuve sociale pour autres clients
           └─> Augmente conversions
```

**Rôle Wasabi** : Stocke testimonial client

---

### Cas 3 : Client Réutilise Audio (Remix)

**Scénario** :
```
1. Client voit vidéo avec musique intéressante
   └─> Clique "Remix"

2. Client enregistre nouvelle vidéo
   └─> Avec même audio
       └─> Partage remix dans feed

3. Résultat
   └─> Remix apparaît dans feed
       └─> Crée tendance/viralité
```

**Rôle Wasabi** : Stocke audio original + vidéo remix

---

## 📊 Résumé : Qui Utilise Duet/Remix ?

### **CLIENTS** (Usage Principal - 90%)

**Pourquoi** :
- ✅ **Engagement** : Réagir à vidéos produits
- ✅ **Testimonials** : Créer preuve sociale
- ✅ **Viralité** : Créer contenu viral
- ✅ **Créativité** : Exprimer créativité

**Cas d'usage** :
- Réaction à vidéo produit
- Testimonial produit
- Review produit
- Démo produit
- Remix audio/musique

---

### **PRESTATAIRES** (Usage Secondaire - 10%)

**Pourquoi** :
- ✅ **Engagement** : Répondre à duets clients
- ✅ **Clarification** : Clarifier points produits
- ✅ **Communauté** : Engager avec communauté

**Cas d'usage** :
- Répondre à duet client
- Clarifier point produit
- Engager avec communauté

---

## 🔄 Rôle Wasabi dans Tout le Système Vidéo

### 1. **Vidéos Créées (Montage)**
- ✅ Stocke vidéos générées par VideoCreationWizardScreen
- ✅ Stocke qualités multiples (360p, 480p, 720p, 1080p)

### 2. **Duets/Remix**
- ✅ Stocke vidéos duet/remix créées par utilisateurs
- ✅ Stocke audio extrait pour remix

### 3. **Distribution**
- ✅ CDN distribue depuis Wasabi
- ✅ Performance optimale pour tous les utilisateurs

### 4. **Scalabilité**
- ✅ Supporte millions de vidéos
- ✅ Économique pour stockage massif

---

## ✅ Conclusion

**Duet/Remix** :
- ✅ **Principalement utilisé par CLIENTS** (90%)
- ✅ **Usage** : Réagir, créer testimonials, remix audio
- ✅ **Résultat** : Engagement, preuve sociale, viralité

**Rôle Wasabi** :
- ✅ **Stocke** toutes les vidéos (créées, duets, remix)
- ✅ **Distribue** via CDN pour performance optimale
- ✅ **Économique** pour stockage massif

**Workflow** :
- Client crée duet → Upload Wasabi → Apparaît dans feed → Engagement

---

*Date : 2025-12-03*  
*Explication complète Duet/Remix et Wasabi*

