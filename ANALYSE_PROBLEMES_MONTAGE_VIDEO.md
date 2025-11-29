# Analyse des Problèmes de Montage Vidéo

## Date : 2025-11-29
## Contexte : Analyse des logs de génération de vidéo produit

---

## 🔴 PROBLÈME PRINCIPAL : Script de Montage Vidéo Non Généré

### Description
L'utilisateur a raison : **il n'y a pas d'étape où le script de montage vidéo (timeline) est généré** dans le flux actuel.

### Flux Actuel (Problématique)

1. ✅ **Étape 1** : L'utilisateur clique sur le bouton vidéo
   - Logs : `ProductVideoCreationModal` - Produit sélectionné
   - ✅ Fonctionne

2. ✅ **Étape 2** : Génération du brief vidéo
   - Endpoint : `POST /api/media/generate-video-brief`
   - Logs : `[AppIA::generate_video_briefs] ✅ Prédiction réussie avec openai-gpt4o (725 tokens)`
   - Temps : 7971ms
   - ✅ Fonctionne

3. ✅ **Étape 3** : Génération du style vidéo
   - Endpoint : `POST /api/media/generate-video-style`
   - Logs : `[AppIA::generate_video_style] ✅ Prédiction réussie avec openai-gpt4o (330 tokens)`
   - Temps : 1260ms
   - ✅ Fonctionne

4. ✅ **Étape 4** : Génération du plan de distribution
   - Endpoint : `POST /api/media/generate-distribution-plan`
   - Logs : `[AppIA::generate_distribution_plan] ✅ Prédiction réussie avec openai-gpt4o (330 tokens)`
   - Temps : 1595ms
   - ✅ Fonctionne

5. ❌ **ÉTAPE MANQUANTE** : **Génération du script de montage vidéo (timeline)**
   - **AUCUN APPEL API** pour générer le script de montage
   - Le `storyboard` envoyé est juste le texte brut de `scriptNotes` (ligne 2122-2125 de ProductVideoCreationModal.tsx)
   - Pas de structuration en timeline avec timing, transitions, effets, etc.

6. ⚠️ **Étape 5** : Soumission de la génération vidéo
   - Endpoint : `POST /api/media/product/{service_id}/{product_index}/generate`
   - Le payload contient `storyboard` mais c'est juste un tableau de lignes de texte
   - Le backend utilise ce storyboard mais ne génère pas de timeline structurée

---

## 🔍 PROBLÈMES IDENTIFIÉS

### 1. Script de Montage Non Généré

**Problème** :
- Le brief génère un `script_outline` (lignes de texte)
- Le style génère des effets, transitions, couleurs
- **MAIS** il n'y a pas de génération d'un script de montage vidéo structuré qui combine :
  - Le timing de chaque scène
  - Les médias à utiliser à chaque moment
  - Les transitions entre scènes
  - Les effets à appliquer
  - La synchronisation avec l'audio/voix off

**Code concerné** :
- `mobile/src/components/ProductVideoCreationModal.tsx` ligne 2122-2125
- `backend/src/services/video_generation_service.rs` ligne 640-647

**Solution nécessaire** :
- Créer un endpoint `/api/media/generate-video-script` ou `/api/media/generate-timeline`
- Cet endpoint doit prendre en entrée :
  - Le brief (script_outline)
  - Le style (effects, transitions, color_palette)
  - Les médias disponibles
  - La durée souhaitée
- Et générer une timeline structurée avec timing précis

### 2. Storyboard Non Structuré

**Problème** :
- Le `storyboard` envoyé est juste un tableau de lignes de texte
- Pas de structure avec timing, médias, transitions

**Code actuel** :
```typescript
storyboard: scriptNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0),
```

**Solution** :
- Générer un storyboard structuré avec :
  - `scene_index`: numéro de la scène
  - `start_time`: temps de début (secondes)
  - `duration`: durée de la scène (secondes)
  - `media_id`: ID du média à utiliser
  - `text`: texte à afficher
  - `transition`: transition vers la scène suivante
  - `effects`: effets à appliquer

### 3. Aucun Média Disponible pour le Produit

**Problème** :
- Logs : `[MediaProduct] 0 médias trouvés` pour service_id=120, product_index=0
- Erreurs 404 pour les images :
  - `/uploads/services/120/ai_generated_120_1_1.jpg` → 404
  - `/uploads/services/120/ai_generated_120_1_2.jpg` → 404
  - `/uploads/services/120/ai_generated_120_1_3.jpg` → 404
  - `/uploads/services/product_video_5afae0a7-b0c2-4bf8-9d30-776830719d18.mp4` → 404

**Impact** :
- La génération vidéo ne peut pas fonctionner sans médias
- Le backend devrait générer automatiquement des images IA si `auto_generate_images: true`

**Code concerné** :
- `backend/src/services/video_generation_service.rs` ligne 800-850

### 4. Utilisation du Brief Non Optimale

**Problème** :
- Le brief est généré mais son `script_outline` n'est pas utilisé pour créer la timeline
- Le backend regénère un storyboard basique si `script_outline` est vide (ligne 649-656)

**Code actuel** :
```rust
if script_outline.is_empty() || payload.auto_storyboard.unwrap_or(false) {
    script_outline = generate_storyboard_lines(
        &primary_product,
        &product_name,
        price_label.clone(),
        promotion_label.clone(),
    );
}
```

**Solution** :
- Utiliser le `script_outline` du brief pour générer la timeline
- Ne pas regénérer un storyboard basique si le brief a déjà fourni un script

---

## 📋 ACTIONS CORRECTIVES NÉCESSAIRES

### Action 1 : Créer l'endpoint de génération de timeline

**Fichier** : `backend/src/controllers/media_controller.rs` ou nouveau fichier

**Endpoint** : `POST /api/media/generate-video-timeline`

**Payload** :
```json
{
  "brief": {
    "script_outline": ["...", "..."],
    "headline": "...",
    "call_to_action": "..."
  },
  "style": {
    "effects": ["..."],
    "transitions": ["..."],
    "color_palette": "..."
  },
  "available_media": [...],
  "duration_seconds": 28,
  "voiceover_script": "...",
  "music_track_id": "..."
}
```

**Réponse** :
```json
{
  "timeline": [
    {
      "scene_index": 0,
      "start_time": 0.0,
      "duration": 3.5,
      "media_id": "...",
      "text": "...",
      "transition": "fade",
      "effects": ["zoom"]
    },
    ...
  ]
}
```

### Action 2 : Intégrer l'appel dans ProductVideoCreationModal

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**Modification** :
- Après la génération du style, appeler `generateVideoTimeline`
- Utiliser la timeline générée au lieu du storyboard texte brut
- Envoyer la timeline structurée dans le payload de `generateProductVideo`

### Action 3 : Modifier le backend pour utiliser la timeline

**Fichier** : `backend/src/services/video_generation_service.rs`

**Modification** :
- Accepter un champ `timeline` dans le payload
- Si `timeline` est fourni, l'utiliser directement
- Sinon, générer une timeline à partir du storyboard

### Action 4 : Corriger la génération automatique d'images

**Fichier** : `backend/src/services/video_generation_service.rs`

**Problème** : Les images IA ne sont pas générées même si `auto_generate_images: true`

**Vérifier** :
- La logique de génération d'images IA (ligne 800-850)
- Les logs d'erreur lors de la génération
- La sauvegarde des images générées

---

## 📊 RÉSUMÉ DES PROBLÈMES

| # | Problème | Gravité | Statut |
|---|----------|---------|--------|
| 1 | Script de montage non généré | 🔴 Critique | ❌ Non résolu |
| 2 | Storyboard non structuré | 🟠 Important | ❌ Non résolu |
| 3 | Aucun média disponible | 🟠 Important | ⚠️ Partiellement résolu (auto_generate_images) |
| 4 | Brief non utilisé optimalement | 🟡 Mineur | ❌ Non résolu |

---

## 🔧 PROCHAINES ÉTAPES

1. **Créer l'endpoint de génération de timeline**
   - Backend : Nouveau endpoint dans `media_controller.rs`
   - Service : Nouvelle fonction dans `app_ia.rs` pour générer la timeline
   - Tests : Vérifier la génération avec différents briefs/styles

2. **Intégrer dans le frontend mobile**
   - Ajouter l'appel API dans `ProductVideoCreationModal.tsx`
   - Afficher la timeline générée à l'utilisateur
   - Permettre l'édition manuelle si nécessaire

3. **Modifier le backend pour utiliser la timeline**
   - Accepter le champ `timeline` dans `VideoGenerationPayload`
   - Utiliser la timeline pour générer la vidéo avec Remotion

4. **Corriger la génération d'images IA**
   - Vérifier les logs d'erreur
   - Tester la génération d'images
   - Vérifier la sauvegarde des fichiers

---

## 📝 NOTES TECHNIQUES

### Structure de Timeline Proposée

```typescript
interface TimelineScene {
  scene_index: number;
  start_time: number;      // secondes
  duration: number;        // secondes
  media_id?: string;       // ID du média à utiliser
  media_url?: string;      // URL du média
  text?: string;           // Texte à afficher
  text_position?: 'top' | 'center' | 'bottom';
  transition?: 'fade' | 'slide' | 'zoom' | 'none';
  effects?: string[];      // Liste des effets à appliquer
  audio_cue?: number;      // Timing pour synchronisation audio
}
```

### Exemple de Timeline Générée

```json
{
  "timeline": [
    {
      "scene_index": 0,
      "start_time": 0.0,
      "duration": 3.0,
      "text": "Découvrez Studio",
      "text_position": "center",
      "transition": "fade",
      "effects": ["zoom"]
    },
    {
      "scene_index": 1,
      "start_time": 3.0,
      "duration": 4.0,
      "media_id": "image_123",
      "text": "Prix spécial : 65000 XAF",
      "text_position": "bottom",
      "transition": "slide",
      "effects": ["glitch"]
    }
  ]
}
```

---

## ✅ VALIDATION

Pour valider les corrections :

1. ✅ Vérifier que l'endpoint `/api/media/generate-video-timeline` existe
2. ✅ Vérifier que la timeline est générée après le style
3. ✅ Vérifier que la timeline est envoyée dans le payload
4. ✅ Vérifier que le backend utilise la timeline pour générer la vidéo
5. ✅ Vérifier que les images IA sont générées si aucun média n'est disponible

---

**Document créé le : 2025-11-29**
**Dernière mise à jour : 2025-11-29**

