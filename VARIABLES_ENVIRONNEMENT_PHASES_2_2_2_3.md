# 📋 Variables d'Environnement - Phases 2.2 et 2.3

## ✅ Phase 2.2 : Bibliothèque Audio Étendue

### Variables Requises

#### Spotify API
```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

**Où les obtenir** :
1. Aller sur https://developer.spotify.com/dashboard
2. Créer une application
3. Récupérer le Client ID et Client Secret

**Utilisation** : Authentification OAuth pour accéder à l'API Spotify

#### YouTube Audio Library (Optionnel)
```bash
YOUTUBE_API_KEY=your_youtube_api_key
```

**Où les obtenir** :
1. Aller sur https://console.cloud.google.com/
2. Créer un projet ou utiliser un projet existant
3. Activer l'API YouTube Data API v3
4. Créer une clé API

**Utilisation** : Accès à la bibliothèque audio YouTube (si implémenté)

---

## ✅ Phase 2.3 : Export 4K et Formats Multiples

### Variables Requises

#### Stockage S3/Wasabi (pour exports finaux)

**Variables existantes dans l'application** (utilisées par `MediaStorageConfig`) :

```bash
# Option 1: Variables S3 (recommandé)
S3_BUCKET=your_bucket_name
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT=https://s3.amazonaws.com  # Optionnel pour AWS, requis pour Wasabi
S3_FORCE_PATH_STYLE=false  # true pour Wasabi/S3-compatible
S3_KEEP_LOCAL_COPY=true  # Garder copie locale après upload
S3_REMOVE_SOURCE_AFTER_UPLOAD=false  # Supprimer source après upload

# Option 2: Variables AWS (compatibles, fallback)
AWS_S3_BUCKET=your_bucket_name  # Utilisé si S3_BUCKET non défini
AWS_REGION=us-east-1  # Utilisé si S3_REGION non défini
AWS_ACCESS_KEY_ID=your_access_key  # Utilisé si S3_ACCESS_KEY non défini
AWS_SECRET_ACCESS_KEY=your_secret_key  # Utilisé si S3_SECRET_KEY non défini
AWS_S3_ENDPOINT=https://s3.amazonaws.com  # Utilisé si S3_ENDPOINT non défini

# Option 3: Wasabi (compatible S3)
# Utiliser les variables S3_* avec :
S3_ENDPOINT=https://s3.wasabisys.com
S3_FORCE_PATH_STYLE=true
S3_REGION=us-east-1  # ou la région Wasabi
```

**Où les obtenir** :
- AWS S3 : https://console.aws.amazon.com/iam/
- Wasabi : https://wasabi.com/

**Utilisation** : Stockage des vidéos exportées après transcodage (réutilise `MediaStorageService` existant)

**Note** : L'application utilise déjà `MediaStorageService` qui supporte S3/Wasabi avec ces variables.

#### FFmpeg (Optionnel - généralement installé système)
```bash
# Si FFmpeg n'est pas dans le PATH
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

**Vérification** :
```bash
ffmpeg -version
ffprobe -version
```

**Note** : FFmpeg est généralement installé au niveau système, pas besoin de variable si dans PATH

---

## 📝 Fichier .env.example

Créer un fichier `.env.example` à la racine du projet backend :

```bash
# Phase 2.2: Bibliothèque Audio Étendue
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=

# Phase 2.3: Export 4K et Formats Multiples
# S3/Wasabi (réutilise MediaStorageService existant)
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY=
S3_SECRET_KEY=
# S3_ENDPOINT=https://s3.amazonaws.com  # Optionnel pour AWS, requis pour Wasabi
# S3_FORCE_PATH_STYLE=false  # true pour Wasabi
# S3_KEEP_LOCAL_COPY=true
# S3_REMOVE_SOURCE_AFTER_UPLOAD=false

# FFmpeg (optionnel - seulement si pas dans PATH)
# FFMPEG_PATH=/usr/bin/ffmpeg
# FFPROBE_PATH=/usr/bin/ffprobe
```

---

## ⚠️ Notes Importantes

1. **Sécurité** : Ne jamais committer le fichier `.env` dans Git
2. **Production** : Utiliser les variables d'environnement du serveur (Render, etc.)
3. **Spotify** : Nécessite un compte Spotify Developer (gratuit)
4. **S3/Wasabi** : Nécessaire pour stocker les exports vidéo finaux
5. **FFmpeg** : Doit être installé sur le serveur backend

---

## ✅ Checklist Configuration

### Phase 2.2
- [ ] SPOTIFY_CLIENT_ID configuré
- [ ] SPOTIFY_CLIENT_SECRET configuré
- [ ] YOUTUBE_API_KEY configuré (optionnel)

### Phase 2.3
- [ ] S3 ou Wasabi configuré
- [ ] FFmpeg installé sur le serveur
- [ ] Variables d'environnement définies

---

**Date** : 2025-01-27  
**Phases concernées** : 2.2 (Bibliothèque Audio), 2.3 (Export 4K)
