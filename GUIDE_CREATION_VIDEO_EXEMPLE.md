# 🎬 Guide de Création - Vidéo Exemple Phase 2

**Date**: 2025-01-20  
**Objectif**: Créer une vraie vidéo guide montrant le processus complet de création vidéo dans Yukpo

---

## 🎯 Contenu de la vidéo

### Durée recommandée
**45-60 secondes** (optimal pour l'attention)

### Structure suggérée

#### 1. Introduction (5-8 secondes)
- **Visuel**: Logo Yukpo + animation
- **Texte**: "Créez des vidéos promotionnelles professionnelles avec Yukpo"
- **Style**: Moderne, accrocheur

#### 2. Sélection du produit (5-8 secondes)
- **Visuel**: Capture d'écran de la sélection d'un produit
- **Texte**: "Sélectionnez votre produit ou service"
- **Montrer**: Interface de sélection, liste de produits

#### 3. Rédaction du brief (8-10 secondes)
- **Visuel**: Capture d'écran du wizard étape 1
- **Texte**: "Rédigez votre brief - L'IA génère automatiquement le script"
- **Montrer**: 
  - Champ de description
  - Headline
  - Call-to-action
  - Estimation du coût

#### 4. Sélection des médias (5-8 secondes)
- **Visuel**: Capture d'écran du wizard étape 2
- **Texte**: "Ajoutez vos images et vidéos"
- **Montrer**: 
  - Galerie de médias
  - Sélection de médias
  - Assignation aux scènes

#### 5. Personnalisation (8-10 secondes)
- **Visuel**: Capture d'écran du wizard étape 3
- **Texte**: "Personnalisez le style, la musique et les effets"
- **Montrer**:
  - Sélection du style (Pulse, Story, Corporate)
  - Choix de la musique
  - Configuration de la voix off
  - Options de publication

#### 6. Génération et résultat (10-15 secondes)
- **Visuel**: 
  - Modal de progression (barre de progression, étapes)
  - Résultat final (vidéo générée)
- **Texte**: "Générez votre vidéo en quelques minutes"
- **Montrer**:
  - Progression en temps réel
  - Vidéo finale avec :
    - Timeline immersive
    - Audio premium
    - Effets visuels
    - Call-to-action intégré

#### 7. Conclusion (3-5 secondes)
- **Visuel**: Logo Yukpo + CTA
- **Texte**: "Créez votre première vidéo maintenant"
- **Style**: Appel à l'action clair

---

## 📋 Checklist de création

### Préparation
- [ ] Préparer les captures d'écran de chaque étape
- [ ] Préparer une vidéo exemple générée (résultat final)
- [ ] Script de narration (si voix off)
- [ ] Musique de fond (optionnel)

### Outils recommandés
- **Capture d'écran**: OBS Studio, ScreenFlow, ou QuickTime
- **Montage**: DaVinci Resolve (gratuit), Premiere Pro, Final Cut
- **Animation**: After Effects (optionnel pour intro/outro)

### Format de sortie
- **Résolution**: 1080p (1920x1080) minimum
- **Format**: MP4 (H.264)
- **Durée**: 45-60 secondes
- **Taille**: < 50 MB (pour chargement rapide)
- **Aspect ratio**: 16:9 (standard) ou 9:16 (mobile vertical)

---

## 📁 Emplacement du fichier

### Backend
```
backend/uploads/examples/video-creation-demo.mp4
```

### Création du dossier
```bash
mkdir -p backend/uploads/examples
```

### Upload du fichier
```bash
# Copier la vidéo dans le dossier
cp video-creation-demo.mp4 backend/uploads/examples/
```

---

## 🔧 Vérification

### Test de l'endpoint
```bash
# Vérifier que la vidéo est accessible
curl -I http://localhost:3001/api/media/examples/video-creation-demo.mp4

# Devrait retourner:
# HTTP/1.1 200 OK
# Content-Type: video/mp4
# Content-Length: [taille du fichier]
```

### Test dans l'app mobile
1. Ouvrir l'app mobile
2. Aller dans l'onglet "Vidéo"
3. Cliquer sur "Voir un exemple"
4. Vérifier que la vidéo se charge et se lit correctement

---

## 🎨 Suggestions de style

### Palette de couleurs
- Utiliser les couleurs de la marque Yukpo
- Primary: #EC4899 (rose)
- Background: Foncé pour contraste
- Texte: Clair et lisible

### Typographie
- Police moderne et lisible
- Tailles: 24-32px pour titres, 16-18px pour texte
- Contraste élevé pour lisibilité

### Animations
- Transitions fluides entre les sections
- Effets de zoom/focus sur les éléments importants
- Animations subtiles (fade, slide)

### Musique (optionnel)
- Musique d'ambiance moderne
- Volume bas pour ne pas couvrir la narration
- Style: Électronique, moderne, professionnel

---

## 📝 Script texte suggéré

```
[0-5s] Introduction
"Créez des vidéos promotionnelles professionnelles avec Yukpo"

[5-13s] Sélection produit
"Sélectionnez votre produit ou service parmi vos créations"

[13-23s] Rédaction brief
"Rédigez votre brief. L'intelligence artificielle génère automatiquement un script adapté à votre produit"

[23-31s] Sélection médias
"Ajoutez vos images et vidéos. L'IA les intègre intelligemment dans votre vidéo"

[31-41s] Personnalisation
"Personnalisez le style, la musique et les effets pour correspondre à votre marque"

[41-56s] Génération
"Générez votre vidéo et suivez la progression en temps réel. Votre vidéo sera prête en quelques minutes"

[56-60s] Conclusion
"Créez votre première vidéo maintenant"
```

---

## ✅ Checklist finale

- [ ] Vidéo créée (45-60 secondes)
- [ ] Format MP4 (H.264)
- [ ] Taille < 50 MB
- [ ] Fichier placé dans `backend/uploads/examples/video-creation-demo.mp4`
- [ ] Test de l'endpoint backend
- [ ] Test dans l'app mobile
- [ ] Fallback testé (si vidéo indisponible)

---

## 🚀 Déploiement

### Production
1. Uploader la vidéo sur le serveur de production
2. Vérifier les permissions du fichier (lecture publique)
3. Tester l'URL de production
4. Mettre à jour le cache CDN si utilisé

### Variables d'environnement
```bash
# S'assurer que UPLOAD_STORAGE_PATH pointe vers le bon dossier
UPLOAD_STORAGE_PATH=/var/data/uploads
```

---

**Status**: 📋 **GUIDE CRÉÉ - EN ATTENTE DE CRÉATION VIDÉO**

Une fois la vidéo créée et placée dans `backend/uploads/examples/video-creation-demo.mp4`, elle sera automatiquement servie par l'endpoint `/api/media/examples/video-creation-demo.mp4` et visible par tous les utilisateurs dans le modal d'exemple.

