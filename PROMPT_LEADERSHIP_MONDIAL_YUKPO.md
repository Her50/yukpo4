# 🚀 PROMPT: Transformation Yukpo en Leader Mondial du Montage Vidéo

## 📋 Contexte du Projet

**Yukpomnang** est une plateforme de montage vidéo intelligent avec IA intégrée, actuellement positionnée dans le **top 5-10 mondial en IA** mais avec des gaps critiques en performance, fluidité et bibliothèques d'effets.

**Objectif** : Transformer Yukpo en **leader mondial absolu** du montage vidéo en 12-18 mois.

**Architecture actuelle** :
- Backend : Rust (Axum, SQLx, PostgreSQL, pgvector)
- Frontend : React Native/TypeScript (Expo)
- IA : Intégration complète (brief, style, timeline, distribution, auto-cut, audio-sync, color grading, captions, previews d'effets, variantes timeline, suggestions audio)
- Base de données : PostgreSQL avec extensions pgvector et imgsmlr
- Rendu : Backend via Remotion (pas de rendu local actuellement)

**⚠️ IMPORTANT - Vérification préalable requise** :
- Il existe **déjà un début de développement d'IA générative** dans le codebase (génération vidéo à partir de texte)
- **AVANT toute implémentation**, tu dois :
  1. Chercher et analyser tout code existant lié à l'IA générative
  2. Identifier les services/fonctions déjà implémentés
  3. Évaluer l'état d'avancement (prototype, partiel, complet)
  4. Documenter ce qui existe avant d'ajouter de nouvelles fonctionnalités
  5. Réutiliser et étendre l'existant plutôt que de créer en doublon

---

## 🎯 PHASE 1 : COURT TERME (3-6 mois) - Performance & Fluidité

### 1.0 Signature/Watermark Yukpo (PRIORITÉ HAUTE)

**⚠️ VÉRIFICATION PRÉALABLE OBLIGATOIRE** :
- **AVANT toute implémentation**, chercher si un système de watermark/signature existe déjà dans le codebase
- Vérifier les services de rendu vidéo (`video_generation_service.rs`, `render_service.rs`, etc.)
- Chercher les endpoints liés au branding/watermark
- Si déjà implémenté, documenter et améliorer. Sinon, implémenter.

**Objectif** : Insérer automatiquement une signature/watermark Yukpo à la fin de chaque vidéo générée pour branding et attribution.

**Spécifications techniques** :
- Créer un système de watermark automatique qui :
  - Insère le logo Yukpo (avec animation optionnelle) à la fin de la vidéo
  - Durée configurable (défaut : 2-3 secondes)
  - Position : coin inférieur droit ou centre (configurable)
  - Opacité : 80-90% pour ne pas gêner le contenu
  - Animation : fade-in/fade-out ou slide (optionnel)
- Backend : Service `watermark_service.rs` qui :
  - Applique le watermark via FFmpeg lors du rendu final
  - Utilise le logo Yukpo stocké dans les assets
  - Supporte différents formats (PNG avec transparence)
  - Option pour désactiver (premium/enterprise)
- Frontend : Toggle dans les paramètres d'export pour activer/désactiver
- Assets : Logo Yukpo en haute résolution (PNG transparent) dans `backend/assets/logo/`

**Fichiers à créer/modifier** :
- `backend/src/services/watermark_service.rs` (si n'existe pas)
- `backend/src/routes/video_routes.rs` (intégrer watermark dans rendu)
- `backend/assets/logo/yukpo_logo.png` (logo haute résolution)
- `mobile/src/components/ExportSettingsPanel.tsx` (toggle watermark)
- `mobile/src/types/ExportSettings.ts` (ajouter option watermark)

**Exemple FFmpeg command** :
```bash
ffmpeg -i input.mp4 -i yukpo_logo.png \
  -filter_complex "[0:v][1:v]overlay=W-w-20:H-h-20:enable='between(t,{end_time}-3,{end_time})',fade=t=in:st={end_time}-3:d=0.5,fade=t=out:st={end_time}-0.5:d=0.5" \
  -c:v libx264 -c:a copy output.mp4
```

**Critères de succès** :
- Watermark appliqué automatiquement à toutes les vidéos générées
- Logo visible mais non intrusif
- Animation fluide (fade-in/out)
- Option de désactivation pour utilisateurs premium
- Performance : ajout de watermark n'ajoute pas > 5% au temps de rendu

---

### 1.1 Preview Temps Réel Pendant l'Édition

**Objectif** : Permettre à l'utilisateur de voir les changements en temps réel pendant qu'il édite, sans attendre un rendu backend.

**Spécifications techniques** :
- Implémenter un **moteur de preview WebGL/Canvas** dans React Native
- Utiliser `react-native-video` avec `expo-gl` pour rendu GPU local
- Créer un service `RealTimePreviewService.ts` qui :
  - Applique les effets/transitions en temps réel sur le device
  - Utilise WebGL shaders pour les effets (zoom, fade, glow, etc.)
  - Maintient un buffer de preview à faible latence (< 100ms)
- Intégrer dans `TimelineEditor.tsx` avec scrubbing fluide
- Backend : Créer un endpoint `/api/video/preview/realtime` qui retourne les paramètres d'effets (pas le vidéo) pour calcul local

**Fichiers à créer/modifier** :
- `mobile/src/services/realTimePreviewService.ts`
- `mobile/src/components/RealTimePreview.tsx`
- `mobile/src/utils/webglEffects.ts` (shaders pour effets)
- `backend/src/services/realtime_preview_service.rs`
- `backend/src/routes/video_routes.rs` (nouveau endpoint)

**Critères de succès** :
- Latence < 100ms entre action utilisateur et preview
- Support de 10+ effets en temps réel
- 60 FPS sur devices modernes
- Pas de lag visible pendant le scrubbing

---

### 1.2 Bibliothèque d'Effets Étendue (50+ Effets)

**Objectif** : Passer de 10 effets de base à 50+ effets professionnels, avec previews et catégorisation.

**Spécifications techniques** :
- Étendre `effect_preview_service.rs` avec 50+ effets :
  - **Catégorie Transitions** (15) : fade, slide, zoom, cube, wipe, dissolve, split, iris, clock, radial, linear, bounce, elastic, flip, rotate
  - **Catégorie Effets Visuels** (20) : blur, sharpen, glow, neon, vintage, blackwhite, warm, cool, sepia, contrast, saturation, brightness, hue, invert, posterize, emboss, edge, mosaic, pixelate, kaleidoscope
  - **Catégorie Animations** (10) : zoom-in, zoom-out, pan-left, pan-right, tilt-up, tilt-down, rotate-360, bounce, shake, pulse
  - **Catégorie Effets Spéciaux** (5) : lens-flare, vignette, grain, chromatic-aberration, glitch
- Créer un système de catégorisation et recherche dans `EffectLibrary.tsx`
- Ajouter des paramètres ajustables pour chaque effet (intensité, vitesse, etc.)
- Backend : Stocker les définitions d'effets dans PostgreSQL avec métadonnées (catégorie, tags, paramètres)

**Fichiers à créer/modifier** :
- `backend/src/services/effect_library_service.rs` (gestion de la bibliothèque)
- `backend/src/models/effect_model.rs` (modèle DB pour effets)
- `mobile/src/services/effectLibraryService.ts`
- `mobile/src/components/EffectLibrary.tsx` (UI avec recherche/filtres)
- `mobile/src/components/EffectParameterPanel.tsx` (ajustement paramètres)

**Critères de succès** :
- 50+ effets fonctionnels avec previews
- Recherche/filtrage par catégorie en < 200ms
- Paramètres ajustables pour chaque effet
- Intégration fluide dans le workflow existant

---

### 1.3 Rendu Local/GPU pour Performance

**Objectif** : Permettre le rendu vidéo directement sur le device utilisateur, sans dépendre du backend.

**Spécifications techniques** :
- Implémenter un **moteur de rendu local** utilisant :
  - `expo-gl` + `expo-gl-cpp` pour accès GPU
  - `react-native-ffmpeg` pour encodage vidéo local
  - Workers Web pour traitement parallèle
- Créer `LocalRenderService.ts` qui :
  - Combine les scènes de timeline
  - Applique les effets/transitions
  - Encode en MP4/H.264 directement sur device
  - Affiche la progression en temps réel
- Backend : Optionnel, servir de fallback si device trop faible
- Optimisations :
  - Utiliser GPU pour effets (shaders)
  - Encodage hardware-accelerated (MediaCodec sur Android, VideoToolbox sur iOS)
  - Cache des assets pré-traités

**Fichiers à créer/modifier** :
- `mobile/src/services/localRenderService.ts`
- `mobile/src/utils/gpuRenderer.ts`
- `mobile/src/components/LocalRenderProgress.tsx`
- `backend/src/services/render_fallback_service.rs` (fallback si device faible)

**Critères de succès** :
- Rendu 30s vidéo en < 2 minutes sur device moyen
- Support GPU hardware-accelerated
- Progression en temps réel
- Fallback backend automatique si device insuffisant

---

### 1.4 Templates par Industrie (50+)

**Objectif** : Créer une bibliothèque de templates pré-configurés par industrie pour démarrage rapide.

**Spécifications techniques** :
- Créer 50+ templates organisés par industrie :
  - **E-commerce** (10) : produit mode, électronique, alimentaire, beauté, maison, sport, jouets, livres, bijoux, accessoires
  - **Services** (10) : restauration, hôtellerie, fitness, éducation, santé, finance, immobilier, transport, événementiel, consulting
  - **Créateurs** (10) : vlog, tutoriel, review, unboxing, gaming, musique, art, cuisine, voyage, lifestyle
  - **Business** (10) : présentation, pitch, annonce, recrutement, formation, webinaire, témoignage, cas client, lancement, événement
  - **Social Media** (10) : TikTok, Instagram Reels, YouTube Shorts, Facebook, LinkedIn, Twitter, Pinterest, Snapchat, WhatsApp, Telegram
- Chaque template inclut : timeline pré-configurée, effets/transitions, style, durée, format
- Backend : Stocker templates dans PostgreSQL avec métadonnées (industrie, tags, popularité)
- UI : Créer `TemplateLibrary.tsx` avec recherche/filtres par industrie

**Fichiers à créer/modifier** :
- `backend/src/models/template_model.rs`
- `backend/src/services/template_service.rs`
- `backend/migrations/XXXX_create_templates.sql`
- `mobile/src/services/templateService.ts`
- `mobile/src/components/TemplateLibrary.tsx`
- `mobile/src/components/TemplatePreview.tsx`

**Critères de succès** :
- 50+ templates fonctionnels
- Recherche/filtrage par industrie en < 200ms
- Preview de template avant application
- Application en 1 clic avec personnalisation

---

## 🎯 PHASE 2 : MOYEN TERME (6-12 mois) - Fonctionnalités Avancées

### 2.1 Timeline Multi-Pistes avec Keyframes

**Objectif** : Permettre l'édition avancée avec plusieurs pistes (vidéo, audio, texte, effets) et animation par keyframes.

**Spécifications techniques** :
- Refondre `TimelineEditor.tsx` pour supporter :
  - **Multi-pistes** : vidéo (plusieurs), audio (plusieurs), texte, effets, graphiques
  - **Keyframes** : position, scale, rotation, opacity, color pour chaque propriété
  - **Courbes d'animation** : ease-in, ease-out, linear, bezier custom
  - **Synchronisation** : snap, guides, magnétisme
- Créer `AdvancedTimelineEditor.tsx` avec :
  - Vue timeline multi-pistes (comme Premiere Pro)
  - Éditeur de keyframes avec courbes
  - Scrubbing avec preview temps réel
  - Zoom/pan de timeline
- Backend : Étendre `VideoTimeline` pour supporter multi-pistes et keyframes

**Fichiers à créer/modifier** :
- `mobile/src/components/AdvancedTimelineEditor.tsx` (refonte complète)
- `mobile/src/components/KeyframeEditor.tsx`
- `mobile/src/components/CurveEditor.tsx`
- `mobile/src/types/AdvancedTimeline.ts` (nouveaux types)
- `backend/src/services/app_ia.rs` (étendre VideoTimeline)

**Critères de succès** :
- Support 5+ pistes simultanées
- Keyframes pour toutes propriétés animables
- Courbes d'animation fluides
- Performance : 60 FPS pendant scrubbing

---

### 2.2 Bibliothèque Audio Étendue (Intégration Spotify/YouTube)

**Objectif** : Intégrer des millions de tracks depuis Spotify/YouTube avec recherche intelligente.

**Spécifications techniques** :
- Intégrer APIs :
  - **Spotify API** : recherche, preview, metadata (BPM, genre, mood)
  - **YouTube Audio Library** : tracks libres de droits
  - **Epidemic Sound** (optionnel) : bibliothèque premium
- Créer `ExtendedAudioLibrary.tsx` avec :
  - Recherche par genre, mood, BPM, durée
  - Preview 30s avant téléchargement
  - Filtres : license, trending, popularité
  - Synchronisation automatique avec timeline
- Backend : Service de proxy/cache pour APIs externes
- Gestion licences : afficher clairement les droits d'usage

**Fichiers à créer/modifier** :
- `backend/src/services/spotify_integration_service.rs`
- `backend/src/services/youtube_audio_service.rs`
- `mobile/src/services/extendedAudioLibraryService.ts`
- `mobile/src/components/ExtendedAudioLibrary.tsx`
- `backend/src/routes/audio_routes.rs` (nouveaux endpoints)

**Critères de succès** :
- Accès à 1M+ tracks via intégrations
- Recherche en < 500ms
- Preview fluide avant téléchargement
- Gestion licences transparente

---

### 2.3 Export 4K et Formats Multiples

**Objectif** : Permettre l'export en 4K et dans tous formats (MP4, MOV, WebM, GIF, etc.).

**Spécifications techniques** :
- Étendre `LocalRenderService.ts` pour supporter :
  - **Résolutions** : 720p, 1080p, 2K, 4K, 8K
  - **Formats** : MP4 (H.264, H.265), MOV (ProRes), WebM (VP9), GIF animé
  - **Qualité** : low, medium, high, ultra
  - **Aspect ratios** : 16:9, 9:16, 1:1, 4:5, 21:9
- Backend : Service de transcodage pour formats complexes (ProRes, etc.)
- UI : Créer `ExportSettingsPanel.tsx` avec toutes options

**Fichiers à créer/modifier** :
- `mobile/src/services/exportService.ts` (étendre)
- `mobile/src/components/ExportSettingsPanel.tsx`
- `backend/src/services/transcoding_service.rs`
- `backend/src/routes/export_routes.rs`

**Critères de succès** :
- Export 4K fonctionnel
- 5+ formats supportés
- Qualité optimale selon format
- Progression en temps réel

---

### 2.4 Collaboration en Temps Réel

**Objectif** : Permettre à plusieurs utilisateurs d'éditer la même vidéo simultanément.

**Spécifications techniques** :
- Implémenter **WebSocket** pour synchronisation temps réel
- Créer `CollaborationService.ts` qui :
  - Gère les sessions collaboratives
  - Synchronise les changements entre utilisateurs
  - Affiche les curseurs/actions des autres
  - Gère les conflits (last-write-wins ou merge)
- Backend : Service WebSocket avec Redis pour pub/sub
- UI : Indicateurs visuels (curseurs, noms, changements en cours)

**Fichiers à créer/modifier** :
- `backend/src/services/collaboration_service.rs`
- `backend/src/routes/websocket_routes.rs`
- `mobile/src/services/collaborationService.ts`
- `mobile/src/components/CollaborationIndicator.tsx`
- `mobile/src/hooks/useCollaboration.ts`

**Critères de succès** :
- 5+ utilisateurs simultanés
- Latence < 200ms entre utilisateurs
- Gestion conflits robuste
- UX fluide et intuitive

---

## 🎯 PHASE 3 : LONG TERME (12-24 mois) - Innovation

### 3.1 IA Générative (Génération Vidéo à Partir de Texte)

**⚠️ VÉRIFICATION PRÉALABLE OBLIGATOIRE** :
- **AVANT toute implémentation**, chercher et analyser tout code existant lié à l'IA générative
- Identifier les services/fonctions déjà implémentés (ex: `video_generation_service.rs`, endpoints `/api/ia/generate-video`, etc.)
- Évaluer l'état d'avancement (prototype, partiel, complet)
- Documenter ce qui existe et réutiliser/étendre plutôt que créer en doublon

**Objectif** : Générer des vidéos complètes à partir de descriptions textuelles.

**Spécifications techniques** (si pas déjà implémenté) :
- Intégrer APIs génératives :
  - **Runway ML** : génération vidéo à partir de texte
  - **Stable Video Diffusion** : génération vidéo open-source
  - **Pika Labs** : génération vidéo courte
- Créer `GenerativeVideoService.ts` qui :
  - Prend une description textuelle
  - Génère storyboard avec IA
  - Génère clips vidéo pour chaque scène
  - Assemble automatiquement en timeline
- Backend : Service de génération avec queue pour traitement asynchrone
- UI : `GenerativeVideoWizard.tsx` avec input texte et preview

**Fichiers à créer/modifier** (si nécessaire après vérification) :
- `backend/src/services/generative_video_service.rs` (si n'existe pas)
- `backend/src/routes/generative_routes.rs`
- `mobile/src/services/generativeVideoService.ts`
- `mobile/src/components/GenerativeVideoWizard.tsx`

**Critères de succès** :
- Génération vidéo 30s en < 5 minutes
- Qualité cohérente avec prompt
- Intégration fluide dans workflow existant

---

### 3.2 AR/VR Editing

**Objectif** : Permettre l'édition vidéo en réalité augmentée/virtuelle.

**Spécifications techniques** :
- Intégrer `react-native-arkit` (iOS) et `ARCore` (Android)
- Créer `ARVideoEditor.tsx` qui :
  - Affiche la timeline en 3D
  - Permet manipulation gestuelle des scènes
  - Preview en AR avec overlay d'effets
- Backend : Service de rendu 3D pour preview AR

**Fichiers à créer/modifier** :
- `mobile/src/components/ARVideoEditor.tsx`
- `mobile/src/services/arRenderService.ts`
- `backend/src/services/ar_preview_service.rs`

**Critères de succès** :
- Édition fonctionnelle en AR
- Tracking stable
- Performance 30+ FPS

---

### 3.3 Marketplace d'Effets Communautaire

**Objectif** : Permettre aux utilisateurs de créer et vendre leurs effets personnalisés.

**Spécifications techniques** :
- Créer système de marketplace :
  - Upload d'effets (shaders, transitions, templates)
  - Système de paiement (Stripe)
  - Reviews/ratings
  - Recherche/filtrage
- Backend : Stockage effets, gestion transactions, modération
- UI : `EffectMarketplace.tsx` avec boutique et upload

**Fichiers à créer/modifier** :
- `backend/src/models/marketplace_effect_model.rs`
- `backend/src/services/marketplace_service.rs`
- `mobile/src/components/EffectMarketplace.tsx`
- `mobile/src/components/EffectUpload.tsx`

**Critères de succès** :
- Upload/vente fonctionnels
- Système paiement sécurisé
- Modération automatique

---

### 3.4 Analytics Avancés de Performance Vidéo

**Objectif** : Fournir des analytics détaillés sur la performance des vidéos générées.

**Spécifications techniques** :
- Intégrer analytics :
  - **YouTube Analytics API** : vues, engagement, retention
  - **TikTok Analytics** : vues, likes, partages
  - **Instagram Insights** : reach, impressions, engagement
- Créer `VideoAnalyticsDashboard.tsx` avec :
  - Métriques en temps réel
  - Graphiques de performance
  - Recommandations IA pour amélioration
- Backend : Service d'agrégation analytics avec cache

**Fichiers à créer/modifier** :
- `backend/src/services/video_analytics_service.rs`
- `mobile/src/services/videoAnalyticsService.ts`
- `mobile/src/components/VideoAnalyticsDashboard.tsx`

**Critères de succès** :
- Analytics multi-plateformes
- Recommandations IA pertinentes
- Dashboard intuitif

---

## 📐 Règles de Développement

### Backend Rust
1. Utiliser `Result<T, E>` pour gestion d'erreurs
2. Implémenter traits pour réutilisabilité
3. Utiliser `async/await` pour opérations asynchrones
4. Valider toutes entrées utilisateur
5. Optimiser requêtes SQL avec index appropriés
6. Tests unitaires pour chaque service

### Frontend React Native
1. Utiliser hooks personnalisés pour logique métier
2. Séparer logique métier des composants UI
3. Utiliser contextes React pour état global
4. Implémenter gestion d'erreur robuste
5. Utiliser TypeScript strictement
6. Optimiser re-renders avec `useMemo`/`useCallback`

### Performance
1. Mesurer avant d'optimiser
2. Utiliser profiling tools (React DevTools, Rust perf)
3. Cache agressif pour assets statiques
4. Lazy loading pour composants lourds
5. Debounce/throttle pour interactions fréquentes

### Tests
1. Tests unitaires pour services backend
2. Tests d'intégration pour endpoints API
3. Tests E2E avec Playwright/Detox
4. Tests de performance (load testing)

---

## 🎯 Critères de Succès Globaux

**Pour être leader mondial, Yukpo doit atteindre** :

1. **Performance** : 60 FPS constant, latence < 100ms
2. **Fonctionnalités** : Parité avec CapCut + innovations IA
3. **Bibliothèques** : 50+ effets, 1M+ tracks audio, 50+ templates
4. **UX** : Intuitive, fluide, guidée par IA
5. **Scalabilité** : Support millions d'utilisateurs simultanés
6. **Qualité** : Export 4K, formats multiples, rendu professionnel

**Score cible** : 9.5/10 (vs 7.5/10 actuel)

---

## 🚀 Ordre d'Implémentation Recommandé

1. **Semaine 0** : Vérification et implémentation signature/watermark Yukpo (PRIORITÉ)
2. **Semaine 1-2** : Vérification IA générative existante + Preview temps réel
2. **Semaine 3-4** : Bibliothèque d'effets étendue (20 premiers effets)
3. **Semaine 5-6** : Rendu local/GPU
4. **Semaine 7-8** : Templates par industrie (20 premiers)
5. **Semaine 9-12** : Timeline multi-pistes + keyframes
6. **Semaine 13-16** : Bibliothèque audio étendue
7. **Semaine 17-20** : Export 4K + formats multiples
8. **Semaine 21-24** : Collaboration temps réel
9. **Semaine 25+** : IA générative (si nécessaire), AR/VR, Marketplace, Analytics

---

## 📝 Notes Importantes

- **Toujours vérifier l'existant avant d'implémenter** (surtout pour IA générative et watermark)
- **Signature Yukpo est PRIORITÉ** : Toutes les vidéos doivent avoir le branding Yukpo
- **Prioriser la performance et la fluidité** (expérience utilisateur > fonctionnalités)
- **Tester sur devices réels** (pas seulement simulateurs)
- **Documenter chaque fonctionnalité** (code comments, README, API docs)
- **Itérer rapidement** (MVP → Feedback → Amélioration)

**Objectif final** : Yukpo leader mondial du montage vidéo intelligent en 12-18 mois 🚀

