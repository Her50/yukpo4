# 📋 Variables d'Environnement Complètes - Toutes les Phases

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

**Note** : Ces variables sont déjà utilisées par `MediaStorageConfig` dans `backend/src/config/storage.rs`. Le code utilise `MediaStorageService` existant.

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

**Note** : Redis est déjà configuré dans l'application. Cette variable est utilisée par `CollaborationService`.

---

## ✅ Phase 3.1 : IA Générative

```bash
# Runway ML
RUNWAY_API_URL=https://api.runwayml.com/v1
RUNWAY_API_KEY=your_runway_api_key

# Pika Labs
PIKA_API_URL=https://api.pika.art/v1
PIKA_API_KEY=your_pika_api_key

# Sora (OpenAI)
SORA_API_URL=https://api.openai.com/v1/video/generations
SORA_API_KEY=your_openai_api_key  # Peut utiliser OPENAI_API_KEY existant
```

**Note** : Ces variables sont déjà utilisées par `BrollConfig` dans `backend/src/config/broll_config.rs`. Le service génératif réutilise cette configuration.

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

# Phase 3.1: IA Générative
RUNWAY_API_URL=https://api.runwayml.com/v1
RUNWAY_API_KEY=
PIKA_API_URL=https://api.pika.art/v1
PIKA_API_KEY=
SORA_API_URL=https://api.openai.com/v1/video/generations
SORA_API_KEY=  # Peut utiliser OPENAI_API_KEY
```

---

## ✅ Alignement Code

- ✅ `ExportService` utilise `MediaStorageService` existant
- ✅ Variables S3 alignées avec `MediaStorageConfig`
- ✅ Variables IA réutilisent `BrollConfig` existant
- ✅ Pas de duplication de variables

---

**Date** : 2025-01-27  
**Phases concernées** : 2.2, 2.3, 2.4, 3.1
