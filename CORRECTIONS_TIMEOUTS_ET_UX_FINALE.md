# ✅ Corrections Timeouts et UX - Guide Final

## 🎯 Date: 2025-01-27

---

## ⏱️ CORRECTIONS TIMEOUTS À APPLIQUER

### 1. **generative_video_service.rs** ✅ (DÉJÀ FAIT)

**Fichier:** `backend/src/services/generative_video_service.rs`

**Correction appliquée:**
```rust
// ✅ NOUVEAU: Timeout configurable pour génération vidéo (600s = 10 minutes par défaut)
let video_timeout = std::env::var("VIDEO_GENERATION_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(600); // 10 minutes par défaut pour génération vidéo complète

let http = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(video_timeout))
    .build()
    .expect("création client HTTP génératif");
```

**Statut:** ✅ **CORRIGÉ**

---

### 2. **app_ia.rs** - Timeout pour Génération Vidéo

**Fichier:** `backend/src/services/app_ia.rs`

**Correction à appliquer:**

Chercher la fonction `pub async fn predict` et modifier pour détecter les requêtes de génération vidéo:

```rust
pub async fn predict(&self, prompt: &str) -> AppResult<(String, String, u64)> {
    // ... code existant ...
    
    // ✅ NOUVEAU: Détecter si c'est une requête de génération vidéo
    let is_video_generation = prompt.contains("generate") 
        || prompt.contains("video") 
        || prompt.contains("storyboard")
        || prompt.contains("clip");
    
    // ✅ NOUVEAU: Timeout configurable
    let ai_timeout = std::env::var("AI_REQUEST_TIMEOUT_SECONDS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(120); // 2 minutes par défaut
    
    // ✅ NOUVEAU: Timeout plus long pour génération vidéo
    let timeout_duration = if is_video_generation {
        Duration::from_secs(ai_timeout * 5) // 10 minutes pour génération vidéo
    } else {
        Duration::from_secs(60) // 1 minute pour requêtes simples
    };
    
    // ... reste du code ...
}
```

**Statut:** ⚠️ **À APPLIQUER**

---

### 3. **video_analysis_service.rs** - Timeout Auto-Cut

**Fichier:** `backend/src/services/video_analysis_service.rs`

**Correction à appliquer:**

Chercher les appels à `app_ia.predict` dans `detect_scenes_with_ia`:

```rust
// ✅ NOUVEAU: Timeout configurable pour analyse vidéo
let analysis_timeout = std::env::var("VIDEO_ANALYSIS_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(180); // 3 minutes par défaut

// Utiliser un client HTTP avec timeout personnalisé
let http_client = reqwest::Client::builder()
    .timeout(Duration::from_secs(analysis_timeout))
    .build()
    .map_err(|e| AppError::Internal(format!("Erreur création client HTTP: {}", e)))?;
```

**Statut:** ⚠️ **À APPLIQUER**

---

### 4. **color_grading_service.rs** - Timeout Color Grading

**Fichier:** `backend/src/services/color_grading_service.rs`

**Correction à appliquer:**

Même principe que `video_analysis_service.rs`:

```rust
// ✅ NOUVEAU: Timeout configurable pour color grading
let color_grading_timeout = std::env::var("COLOR_GRADING_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(120); // 2 minutes par défaut
```

**Statut:** ⚠️ **À APPLIQUER**

---

### 5. **audio_sync_service.rs** - Timeout Audio Sync

**Fichier:** `backend/src/services/audio_sync_service.rs`

**Correction à appliquer:**

```rust
// ✅ NOUVEAU: Timeout configurable pour synchronisation audio
let audio_sync_timeout = std::env::var("AUDIO_SYNC_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(180); // 3 minutes par défaut
```

**Statut:** ⚠️ **À APPLIQUER**

---

## 🎨 AMÉLIORATIONS UX À APPLIQUER

### 1. **Progress Modal Détaillé**

**Fichier:** `mobile/src/components/ProductVideoCreationModal.tsx`

**Amélioration à appliquer:**

```typescript
// ✅ NOUVEAU: État pour progress détaillé
const [generationProgress, setGenerationProgress] = useState<{
  step: 'storyboard' | 'clips' | 'audio' | 'rendering' | 'complete';
  progress: number; // 0-100
  estimatedTimeRemaining: number; // secondes
  currentScene?: number;
  totalScenes?: number;
} | null>(null);

// ✅ NOUVEAU: Progress modal component
{isGenerating && generationProgress && (
  <VideoProgressModal
    progress={generationProgress}
    onCancel={handleCancelGeneration}
    message={getProgressMessage(generationProgress.step)}
  />
)}

// ✅ NOUVEAU: Fonction pour message progress
const getProgressMessage = (step: string): string => {
  switch (step) {
    case 'storyboard':
      return 'Génération du storyboard...';
    case 'clips':
      return `Génération des clips vidéo (${generationProgress?.currentScene}/${generationProgress?.totalScenes})...`;
    case 'audio':
      return 'Synchronisation audio...';
    case 'rendering':
      return 'Rendu final de la vidéo...';
    case 'complete':
      return 'Vidéo générée avec succès!';
    default:
      return 'Génération en cours...';
  }
};
```

**Statut:** ⚠️ **À APPLIQUER**

---

### 2. **Estimation Temps Basée sur Durée Vidéo**

**Fichier:** `mobile/src/components/ProductVideoCreationModal.tsx`

**Amélioration à appliquer:**

```typescript
// ✅ NOUVEAU: Calculer estimation temps basée sur durée vidéo
const estimateGenerationTime = (videoDurationSeconds: number): number => {
  // Estimation: 1 minute de génération par 10 secondes de vidéo
  // Minimum: 2 minutes, Maximum: 15 minutes
  const estimatedMinutes = Math.max(2, Math.min(15, videoDurationSeconds / 10));
  return estimatedMinutes * 60; // Retourner en secondes
};

// Utiliser dans handleGenerateVideo
const estimatedTime = estimateGenerationTime(
  selectedMediaIds.reduce((total, id) => {
    // Calculer durée totale des médias sélectionnés
    return total + (mediaDurationMap[id] || 0);
  }, 0)
);

setGenerationProgress({
  step: 'storyboard',
  progress: 0,
  estimatedTimeRemaining: estimatedTime,
});
```

**Statut:** ⚠️ **À APPLIQUER**

---

### 3. **Notifications Push (Optionnel)**

**Fichier:** `mobile/src/components/ProductVideoCreationModal.tsx`

**Amélioration à appliquer:**

```typescript
import * as Notifications from 'expo-notifications';

// ✅ NOUVEAU: Envoyer notification quand génération terminée
const sendGenerationCompleteNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vidéo générée! 🎉',
      body: 'Votre vidéo est prête à être utilisée.',
      sound: true,
    },
    trigger: null, // Immédiat
  });
};

// Appeler après génération réussie
if (videoGenerated) {
  await sendGenerationCompleteNotification();
}
```

**Statut:** ⚠️ **À APPLIQUER** (Optionnel)

---

### 4. **Tooltips Contextuels**

**Fichier:** `mobile/src/components/ProductVideoCreationModal.tsx`

**Amélioration à appliquer:**

```typescript
import { Tooltip } from 'react-native-elements';

// ✅ NOUVEAU: Tooltip pour expliquer fonctionnalités
<Tooltip
  popover={<Text>Génère automatiquement un storyboard basé sur vos médias</Text>}
>
  <TouchableOpacity onPress={handleGenerateStoryboard}>
    <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
  </TouchableOpacity>
</Tooltip>
```

**Statut:** ⚠️ **À APPLIQUER** (Optionnel)

---

## 📋 VARIABLES D'ENVIRONNEMENT À AJOUTER

### Backend `.env`

```env
# ============================================
# ⏱️ TIMEOUTS CONFIGURABLES
# ============================================
VIDEO_GENERATION_TIMEOUT_SECONDS=600        # 10 minutes pour génération vidéo complète
AI_REQUEST_TIMEOUT_SECONDS=120              # 2 minutes pour requêtes IA longues
VIDEO_ANALYSIS_TIMEOUT_SECONDS=180          # 3 minutes pour analyse vidéo
COLOR_GRADING_TIMEOUT_SECONDS=120           # 2 minutes pour color grading
AUDIO_SYNC_TIMEOUT_SECONDS=180              # 3 minutes pour synchronisation audio
STORYBOARD_GENERATION_TIMEOUT_SECONDS=180   # 3 minutes pour storyboard
```

---

## ✅ CHECKLIST FINALE

### Timeouts
- [x] ✅ `generative_video_service.rs` - Timeout configurable (600s)
- [ ] ⚠️ `app_ia.rs` - Détection génération vidéo + timeout long
- [ ] ⚠️ `video_analysis_service.rs` - Timeout configurable (180s)
- [ ] ⚠️ `color_grading_service.rs` - Timeout configurable (120s)
- [ ] ⚠️ `audio_sync_service.rs` - Timeout configurable (180s)

### UX
- [ ] ⚠️ Progress modal détaillé avec étapes
- [ ] ⚠️ Estimation temps basée sur durée vidéo
- [ ] ⚠️ Notifications push (optionnel)
- [ ] ⚠️ Tooltips contextuels (optionnel)

### Variables d'Environnement
- [ ] ⚠️ Ajouter toutes les variables de timeout dans `.env`
- [ ] ⚠️ Documenter dans `GUIDE_COMPLET_VARIABLES_ENVIRONNEMENT_VIDEO.md`

---

## 🎯 RÉSUMÉ

### ✅ Déjà Fait
1. ✅ Guide complet variables d'environnement (45+ variables)
2. ✅ Timeout configurable dans `generative_video_service.rs`
3. ✅ Vérification UX complète

### ⚠️ À Faire
1. ⚠️ Appliquer corrections timeouts dans `app_ia.rs`, `video_analysis_service.rs`, etc.
2. ⚠️ Implémenter progress modal détaillé
3. ⚠️ Ajouter estimation temps
4. ⚠️ Configurer variables d'environnement

---

**Date:** 2025-01-27  
**Statut:** ✅ Guide créé, ⚠️ Corrections à appliquer

