# 📋 Variables d'Environnement Complètes - Phases 2.2, 2.3, 2.4

## ✅ Phase 2.2 : Bibliothèque Audio Étendue

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key  # Optionnel
```

---

## ✅ Phase 2.3 : Export 4K et Formats Multiples

### Stockage S3/Wasabi

**Variables utilisées par `MediaStorageService` existant** :

```bash
# Variables principales (préfixe S3_)
S3_BUCKET=your_bucket_name
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT=https://s3.amazonaws.com  # Optionnel pour AWS, requis pour Wasabi
S3_FORCE_PATH_STYLE=false  # true pour Wasabi/S3-compatible
S3_KEEP_LOCAL_COPY=true
S3_REMOVE_SOURCE_AFTER_UPLOAD=false

# Variables de fallback (préfixe AWS_ - utilisées si S3_* non définies)
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_ENDPOINT=https://s3.amazonaws.com
```

**Pour Wasabi** :
```bash
S3_ENDPOINT=https://s3.wasabisys.com
S3_FORCE_PATH_STYLE=true
S3_REGION=us-east-1
```

### FFmpeg

```bash
# Optionnel - seulement si FFmpeg n'est pas dans PATH
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

---

## ✅ Phase 2.4 : Collaboration en Temps Réel

```bash
REDIS_URL=redis://127.0.0.1:6379
```

---

## 📝 Fichier .env.example Complet

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

# Phase 2.4: Collaboration en Temps Réel
REDIS_URL=redis://127.0.0.1:6379
```

---

## ✅ Alignement Code

- ✅ `ExportService` utilise `MediaStorageService` existant
- ✅ Variables S3 alignées avec `MediaStorageConfig`
- ✅ Pas de duplication de variables
- ✅ Support Wasabi confirmé

---

**Date** : 2025-01-27  
**Statut** : ✅ COMPLET ET ALIGNÉ

