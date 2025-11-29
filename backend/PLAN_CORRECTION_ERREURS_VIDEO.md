# Plan de Correction - Erreurs Processus Montage Vidéo

Date : 2025-11-29  
Fichier analysé : `logbackend3.md` (2792 lignes)

---

## 🔴 ERREURS CRITIQUES IDENTIFIÉES

### 1. ❌ ERREUR FFmpeg - Stream Audio Manquant dans Vidéo Combinée

**Description** :  
Le fichier vidéo `combined.mp4` généré n'a pas de stream audio, mais le code essaie de mixer l'audio avec `[0:a]amix`.

**Erreur complète** :
```
Stream specifier ':a' in filtergraph description [0:a]amix=inputs=1:duration=first:dropout_transition=3[aout];[aout]loudnorm=I=-14:TP=-1.5[a_final] matches no streams.
```

**Lignes dans les logs** :
- Ligne 218, 220 : `[ProductVideoController] ❌ Erreur génération vidéo`
- Ligne 221 : `[AudioPipeline] mix command: ffmpeg -y -i combined.mp4 -filter_complex [0:a]amix=...`
- Ligne 222 : `[VideoGeneration] Génération musique échouée`

**Cause racine** :  
Le fichier `combined.mp4` est généré sans stream audio (seulement vidéo), mais le code `audio_pipeline.rs` essaie d'extraire `[0:a]` qui n'existe pas.

**Fichiers concernés** :
- `backend/src/services/audio_pipeline.rs` (ligne 163)
- `backend/src/services/video_generation_service.rs` (ligne 3396, 3443)

**Plan de correction** :
1. Vérifier si le fichier vidéo a un stream audio avant d'essayer de le mixer
2. Si pas d'audio, créer un stream audio silencieux ou utiliser uniquement la musique de fond
3. Adapter la commande FFmpeg selon la présence ou non d'audio

---

### 2. ❌ ERREUR DNS - CDN Inaccessible

**Description** :  
Le domaine `cdn.yukpomnang.com` n'est pas résolu par le DNS.

**Erreur complète** :
```
Téléchargement audio IA impossible: error sending request for url (https://cdn.yukpomnang.com/audio/lofi_sunset_80.mp3): error trying to connect: dns error: failed to lookup address information: Name or service not known
```

**Lignes dans les logs** :
- Ligne 223 : `[VideoGeneration] Impossible d'utiliser la boucle lofi_sunset`
- Ligne 224-225 : Tentative de connexion à `cdn.yukpomnang.com`

**Cause racine** :  
Le domaine CDN n'existe pas ou n'est pas configuré correctement.

**Fichiers concernés** :
- `backend/src/services/video_generation_service.rs` (ligne 3443)

**Plan de correction** :
1. Vérifier si le CDN est configuré et accessible
2. Ajouter un fallback vers un stockage local ou un autre CDN
3. Gérer gracieusement l'erreur DNS avec un fallback vers des fichiers audio locaux
4. Ajouter un retry avec timeout pour les requêtes DNS

---

### 3. ❌ ERREUR FFmpeg - Génération Musique Échouée

**Description** :  
La génération de musique de fond échoue avec une erreur MP3 invalide.

**Erreur complète** :
```
[mp3 @ 0x5a58c4bc9540] Invalid audio stream. Exactly one MP3 audio stream is required.
Could not write header for output file #0 (incorrect codec parameters ?): Invalid argument
Error initializing output stream 0:0
```

**Lignes dans les logs** :
- Ligne 222 : `[VideoGeneration] Génération musique échouée`

**Cause racine** :  
Le code essaie de générer de la musique avec FFmpeg mais le format de sortie ou les paramètres sont incorrects.

**Fichiers concernés** :
- `backend/src/services/video_generation_service.rs` (ligne 3396)

**Plan de correction** :
1. Vérifier les paramètres de génération de musique
2. Corriger le format de sortie (MP3 vs WAV)
3. Ajouter une validation des paramètres avant l'exécution FFmpeg
4. Implémenter un fallback vers des fichiers audio pré-générés

---

### 4. ⚠️ WARNING - Pipeline Critical (7 Stale Jobs)

**Description** :  
Le pipeline de génération vidéo a 7 jobs bloqués depuis plus de 30 minutes et 1 job échoué dans les 24h.

**Lignes dans les logs** :
- Ligne 114 : `[PipelineWorker] Statut pipeline "critical" | stale_jobs=7 | failed24h=1`

**Cause racine** :  
Les jobs de génération vidéo restent bloqués en statut `queued` ou `running` sans progresser.

**Fichiers concernés** :
- `backend/src/tasks/pipeline_health_worker.rs` (ligne 79)
- `backend/src/services/video_generation_service.rs`

**Plan de correction** :
1. Implémenter un système de timeout pour les jobs bloqués
2. Ajouter un mécanisme de retry automatique
3. Marquer les jobs stale comme `failed` après un certain temps
4. Améliorer le logging pour identifier pourquoi les jobs restent bloqués

---

### 5. ❌ ERREUR 500 - `/api/media/undefined/track-view`

**Description** :  
L'endpoint `/api/media/undefined/track-view` retourne une erreur 500.

**Lignes dans les logs** :
- Ligne 1943 : `POST /api/media/undefined/track-view -> 500`
- Ligne 1977 : `[POST]500 ... /api/media/undefined/track-view`

**Cause racine** :  
Le paramètre `media_id` est `undefined` au lieu d'un ID valide. Le code backend ne gère pas ce cas.

**Fichiers concernés** :
- `backend/src/controllers/media_controller.rs` ou similaire
- Code mobile qui appelle cet endpoint avec `undefined`

**Plan de correction** :
1. Valider le paramètre `media_id` dans le controller
2. Retourner une erreur 400 (Bad Request) au lieu de 500 si `media_id` est invalide
3. Corriger le code mobile pour ne pas envoyer `undefined`

---

### 6. ❌ ERREURS 500 - Endpoints IA (Déjà Corrigés ?)

**Description** :  
Les endpoints IA retournent encore des erreurs 500.

**Lignes dans les logs** :
- Ligne 2080 : `POST /api/media/generate-video-brief -> 500`
- Ligne 2167 : `POST /api/media/generate-distribution-plan -> 500`

**Statut** :  
⚠️ **À VÉRIFIER** - Ces erreurs ont été corrigées dans le code, mais le build n'a pas encore été relancé.

**Action requise** :
1. Vérifier que les corrections sont bien dans le code
2. Relancer le build pour appliquer les corrections
3. Si les erreurs persistent après le build, investiguer plus en profondeur

---

### 7. ❌ ERREURS 500 - `/api/audio-library/*/attach/*`

**Description** :  
Les endpoints d'attachement de bibliothèque audio retournent des erreurs 500.

**Lignes dans les logs** :
- Ligne 2484 : `POST /api/audio-library/ambient_wave/attach/120 -> 500`
- Ligne 2499 : `POST /api/audio-library/lofi_sunset/attach/120 -> 500`
- Ligne 2557 : `POST /api/audio-library/pulse_groove/attach/120 -> 500`

**Cause racine** :  
Probablement lié au problème DNS (erreur #2) ou à un problème de validation des paramètres.

**Fichiers concernés** :
- `backend/src/controllers/audio_controller.rs` ou similaire

**Plan de correction** :
1. Vérifier la gestion d'erreur dans le controller audio
2. Ajouter des logs détaillés pour identifier la cause exacte
3. Implémenter un fallback si le CDN est inaccessible

---

### 8. ⚠️ WARNING - Dossier SFX Introuvable

**Description** :  
Le dossier `assets/sfx` n'existe pas pour la timeline immersive.

**Lignes dans les logs** :
- Ligne 261 : `[VideoGeneration] Dossier SFX introuvable pour la timeline immersive (assets/sfx)`

**Cause racine** :  
Le dossier n'existe pas ou n'est pas accessible.

**Fichiers concernés** :
- `backend/src/services/video_generation_service.rs` (ligne 1290)

**Plan de correction** :
1. Créer le dossier s'il n'existe pas
2. Vérifier les permissions d'accès
3. Ajouter un fallback si le dossier n'existe pas (continuer sans SFX)

---

## 📋 RÉSUMÉ DES ACTIONS

### Priorité CRITIQUE (Bloque la génération vidéo) :
1. ✅ **Erreur #1** - Stream audio manquant (FFmpeg)
2. ✅ **Erreur #2** - DNS CDN inaccessible
3. ✅ **Erreur #3** - Génération musique échouée

### Priorité HAUTE (Affecte l'expérience utilisateur) :
4. ✅ **Erreur #5** - `/api/media/undefined/track-view` 500
5. ✅ **Erreur #7** - `/api/audio-library/*/attach/*` 500
6. ✅ **Warning #4** - Pipeline critical (stale jobs)

### Priorité MOYENNE (Amélioration) :
7. ✅ **Warning #8** - Dossier SFX introuvable

### À VÉRIFIER (Déjà corrigés ?) :
8. ⚠️ **Erreur #6** - Endpoints IA 500 (vérifier si corrections appliquées)

---

## 🔍 VÉRIFICATIONS NÉCESSAIRES

### Vérifier les corrections déjà appliquées :
1. ✅ Vérifier que `app_ia.rs` a bien les corrections (ordre inversé, extraction JSON)
2. ✅ Vérifier que `ia_controller.rs` a bien les fallbacks
3. ✅ Vérifier que `media_product_controller.rs` a bien la correction TIMESTAMP

### Vérifier la configuration :
1. ✅ Vérifier que le CDN `cdn.yukpomnang.com` est configuré
2. ✅ Vérifier que le dossier `assets/sfx` existe
3. ✅ Vérifier les permissions d'accès aux fichiers

---

## 📝 PROCHAINES ÉTAPES

1. **Analyser le code source** pour chaque erreur identifiée
2. **Vérifier les corrections déjà appliquées** (erreurs #6)
3. **Implémenter les corrections manquantes** (erreurs #1, #2, #3, #5, #7, #8)
4. **Tester les corrections** après le build
5. **Documenter les changements**

