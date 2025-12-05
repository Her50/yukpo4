# 🎯 Spécifications Techniques - Fonctionnalités IA Manquantes

## 📋 Vue d'Ensemble

Ce document détaille les spécifications techniques pour implémenter les 4 fonctionnalités IA prioritaires identifiées dans l'analyse.

---

## 1. 🔴 Auto-Cut Intelligent (Priorité Haute)

### 1.1 Description

Détection automatique de scènes dans les vidéos longues, suppression des silences, et extraction des moments clés (highlights) pour optimiser le montage.

### 1.2 Objectifs

- Réduction du temps de montage de 70%
- Extraction automatique des meilleurs moments
- Suppression intelligente des silences
- Détection de transitions naturelles

### 1.3 Spécifications Techniques

#### Backend API Endpoint

```rust
// backend/src/routes/ia_routes.rs

#[derive(Serialize, Deserialize)]
pub struct AutoCutRequest {
    pub video_url: String,
    pub video_id: Option<i32>,
    pub min_scene_duration: Option<f64>, // secondes, défaut: 2.0
    pub max_scene_duration: Option<f64>, // secondes, défaut: 10.0
    pub silence_threshold: Option<f64>,   // dB, défaut: -40.0
    pub detect_highlights: Option<bool>,  // défaut: true
    pub target_duration: Option<f64>,     // secondes, optionnel
}

#[derive(Serialize, Deserialize)]
pub struct AutoCutResponse {
    pub success: bool,
    pub scenes: Vec<SceneCut>,
    pub highlights: Vec<Highlight>,
    pub total_duration: f64,
    pub original_duration: f64,
    pub silence_removed: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SceneCut {
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
    pub confidence: f64,        // 0.0-1.0
    pub scene_type: String,     // "action", "dialogue", "transition", etc.
    pub thumbnail_url: Option<String>,
    pub audio_level: f64,        // dB moyen
    pub motion_score: f64,       // 0.0-1.0
}

#[derive(Serialize, Deserialize)]
pub struct Highlight {
    pub start_time: f64,
    pub end_time: f64,
    pub score: f64,              // 0.0-1.0
    pub reason: String,          // "high_motion", "audio_peak", "face_detection", etc.
}

// POST /api/ia/video/auto-cut
pub async fn handle_auto_cut(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AutoCutRequest>,
) -> Result<Json<AutoCutResponse>, StatusCode> {
    // 1. Télécharger la vidéo
    // 2. Analyser avec FFmpeg + ML models
    // 3. Détecter scènes, silences, highlights
    // 4. Retourner résultats
}
```

#### Algorithme de Détection

```python
# backend/src/services/video_analysis_service.py (ou Rust équivalent)

def detect_scenes(video_path: str, config: AutoCutConfig) -> List[SceneCut]:
    """
    Détecte les scènes dans une vidéo en utilisant:
    - Changements de frame (différence de pixels)
    - Changements audio (volume, fréquence)
    - Détection de visages (si disponible)
    - Détection de mouvement
    """
    scenes = []
    
    # 1. Analyse vidéo frame par frame
    frames = extract_frames(video_path, fps=1)  # 1 frame/seconde
    
    # 2. Calculer différences entre frames
    frame_diffs = calculate_frame_differences(frames)
    
    # 3. Détecter pics de changement (transitions)
    transition_points = detect_transitions(frame_diffs, threshold=0.3)
    
    # 4. Analyser audio pour silences
    audio_analysis = analyze_audio(video_path)
    silence_segments = detect_silences(audio_analysis, threshold=config.silence_threshold)
    
    # 5. Combiner détections
    scenes = merge_detections(transition_points, silence_segments)
    
    # 6. Filtrer par durée minimale/maximale
    scenes = filter_by_duration(scenes, config.min_scene_duration, config.max_scene_duration)
    
    return scenes

def detect_highlights(video_path: str, scenes: List[SceneCut]) -> List[Highlight]:
    """
    Détecte les moments clés (highlights) dans les scènes
    """
    highlights = []
    
    for scene in scenes:
        # 1. Score de mouvement
        motion_score = calculate_motion_score(scene)
        
        # 2. Score audio (pics, musique)
        audio_score = calculate_audio_score(scene)
        
        # 3. Détection de visages (si disponible)
        face_score = detect_faces_in_scene(scene)
        
        # 4. Score combiné
        total_score = (motion_score * 0.4 + audio_score * 0.4 + face_score * 0.2)
        
        if total_score > 0.7:  # Seuil pour highlight
            highlights.append(Highlight(
                start_time=scene.start_time,
                end_time=scene.end_time,
                score=total_score,
                reason=determine_reason(motion_score, audio_score, face_score)
            ))
    
    return sorted(highlights, key=lambda h: h.score, reverse=True)
```

#### Intégration Frontend

```typescript
// mobile/src/services/videoAnalysisService.ts

export interface AutoCutRequest {
  video_url: string;
  video_id?: number;
  min_scene_duration?: number;
  max_scene_duration?: number;
  silence_threshold?: number;
  detect_highlights?: boolean;
  target_duration?: number;
}

export interface SceneCut {
  start_time: number;
  end_time: number;
  duration: number;
  confidence: number;
  scene_type: string;
  thumbnail_url?: string;
  audio_level: number;
  motion_score: number;
}

export interface Highlight {
  start_time: number;
  end_time: number;
  score: number;
  reason: string;
}

export interface AutoCutResponse {
  success: boolean;
  scenes: SceneCut[];
  highlights: Highlight[];
  total_duration: number;
  original_duration: number;
  silence_removed: number;
}

export const videoAnalysisService = {
  async autoCut(request: AutoCutRequest): Promise<AutoCutResponse> {
    const response = await iaApi.post('/api/ia/video/auto-cut', request);
    if (!response.success) {
      throw new Error(response.error || 'Auto-cut failed');
    }
    return response.data as AutoCutResponse;
  },
};
```

#### Composant UI

```typescript
// mobile/src/components/AutoCutPanel.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { videoAnalysisService, SceneCut, Highlight } from '../services/videoAnalysisService';
import { modernColors } from '../theme/modernTheme';

interface AutoCutPanelProps {
  videoUrl: string;
  videoId?: number;
  onScenesSelected: (scenes: SceneCut[]) => void;
}

export const AutoCutPanel: React.FC<AutoCutPanelProps> = ({
  videoUrl,
  videoId,
  onScenesSelected,
}) => {
  const [loading, setLoading] = useState(false);
  const [scenes, setScenes] = useState<SceneCut[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());

  const handleAutoCut = async () => {
    setLoading(true);
    try {
      const result = await videoAnalysisService.autoCut({
        video_url: videoUrl,
        video_id: videoId,
        min_scene_duration: 2.0,
        max_scene_duration: 10.0,
        silence_threshold: -40.0,
        detect_highlights: true,
      });

      setScenes(result.scenes);
      setHighlights(result.highlights);
      
      // Auto-sélectionner les highlights
      const highlightIndices = new Set<number>();
      highlights.forEach((h, idx) => {
        const sceneIdx = scenes.findIndex(
          s => s.start_time <= h.start_time && s.end_time >= h.end_time
        );
        if (sceneIdx >= 0) highlightIndices.add(sceneIdx);
      });
      setSelectedScenes(highlightIndices);
    } catch (error) {
      console.error('[AutoCutPanel] Error:', error);
      Alert.alert('Erreur', 'Impossible de découper la vidéo automatiquement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.autoCutButton}
        onPress={handleAutoCut}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <SafeIcon name="scissors" size={20} color="#FFF" />
            <Text style={styles.autoCutButtonText}>Découper automatiquement</Text>
          </>
        )}
      </TouchableOpacity>

      {scenes.length > 0 && (
        <ScrollView style={styles.scenesList}>
          {scenes.map((scene, index) => {
            const isHighlight = highlights.some(
              h => h.start_time >= scene.start_time && h.end_time <= scene.end_time
            );
            const isSelected = selectedScenes.has(index);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.sceneCard,
                  isSelected && styles.sceneCardSelected,
                  isHighlight && styles.sceneCardHighlight,
                ]}
                onPress={() => {
                  const newSelected = new Set(selectedScenes);
                  if (newSelected.has(index)) {
                    newSelected.delete(index);
                  } else {
                    newSelected.add(index);
                  }
                  setSelectedScenes(newSelected);
                }}
              >
                <View style={styles.sceneHeader}>
                  <Text style={styles.sceneNumber}>Scène {index + 1}</Text>
                  {isHighlight && (
                    <View style={styles.highlightBadge}>
                      <SafeIcon name="star" size={12} color="#F59E0B" />
                      <Text style={styles.highlightText}>Highlight</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sceneTime}>
                  {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                  {' '}({scene.duration.toFixed(1)}s)
                </Text>
                <View style={styles.sceneMeta}>
                  <Text style={styles.sceneType}>{scene.scene_type}</Text>
                  <Text style={styles.sceneConfidence}>
                    Confiance: {(scene.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedScenes.size > 0 && (
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => {
            const selected = scenes.filter((_, idx) => selectedScenes.has(idx));
            onScenesSelected(selected);
          }}
        >
          <Text style={styles.applyButtonText}>
            Utiliser {selectedScenes.size} scène{selectedScenes.size > 1 ? 's' : ''} sélectionnée{selectedScenes.size > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### 1.4 Plan d'Implémentation

**Phase 1: Backend (1 semaine)**
1. Créer endpoint `/api/ia/video/auto-cut`
2. Implémenter détection de scènes (FFmpeg + ML)
3. Implémenter détection de silences
4. Implémenter détection de highlights
5. Tests unitaires

**Phase 2: Frontend (3 jours)**
1. Créer `videoAnalysisService.ts`
2. Créer composant `AutoCutPanel.tsx`
3. Intégrer dans `ProductVideoCreationModal`
4. Tests UI

**Phase 3: Optimisation (2 jours)**
1. Cache des résultats
2. Progressive loading
3. Performance optimization

**Total**: 2 semaines

---

## 2. 🔴 Synchronisation Audio-Vidéo Automatique (Priorité Haute)

### 2.1 Description

Synchronisation automatique de l'audio avec le rythme vidéo, détection de beats, et audio ducking intelligent.

### 2.2 Objectifs

- Synchronisation parfaite audio-vidéo
- Beat detection automatique
- Audio ducking (réduction volume musique pendant dialogue)
- Sync avec transitions vidéo

### 2.3 Spécifications Techniques

#### Backend API Endpoint

```rust
// backend/src/routes/ia_routes.rs

#[derive(Serialize, Deserialize)]
pub struct AudioSyncRequest {
    pub video_url: String,
    pub audio_url: Option<String>,
    pub music_track_id: Option<i32>,
    pub beat_detection: Option<bool>,      // défaut: true
    pub auto_ducking: Option<bool>,       // défaut: true
    pub sync_with_transitions: Option<bool>, // défaut: true
    pub target_bpm: Option<f64>,          // optionnel
}

#[derive(Serialize, Deserialize)]
pub struct AudioSyncResponse {
    pub success: bool,
    pub synced_audio_url: String,
    pub beats: Vec<Beat>,
    pub bpm: f64,
    pub sync_points: Vec<SyncPoint>,
    pub ducking_segments: Vec<DuckingSegment>,
}

#[derive(Serialize, Deserialize)]
pub struct Beat {
    pub time: f64,           // secondes
    pub confidence: f64,     // 0.0-1.0
    pub strength: f64,       // 0.0-1.0
}

#[derive(Serialize, Deserialize)]
pub struct SyncPoint {
    pub video_time: f64,
    pub audio_time: f64,
    pub beat_time: f64,
    pub sync_type: String,   // "transition", "cut", "highlight"
}

#[derive(Serialize, Deserialize)]
pub struct DuckingSegment {
    pub start_time: f64,
    pub end_time: f64,
    pub duck_level: f64,     // 0.0-1.0 (1.0 = silence complet)
    pub reason: String,      // "dialogue", "voiceover", "sound_effect"
}

// POST /api/ia/video/audio-sync
pub async fn handle_audio_sync(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AudioSyncRequest>,
) -> Result<Json<AudioSyncResponse>, StatusCode> {
    // 1. Détecter beats dans l'audio
    // 2. Analyser transitions vidéo
    // 3. Synchroniser beats avec transitions
    // 4. Appliquer audio ducking si nécessaire
    // 5. Générer audio synchronisé
}
```

#### Algorithme de Beat Detection

```python
# backend/src/services/audio_analysis_service.py

def detect_beats(audio_path: str) -> Tuple[List[Beat], float]:
    """
    Détecte les beats dans un fichier audio en utilisant:
    - Analyse de fréquence (FFT)
    - Détection de pics d'énergie
    - Machine Learning pour amélioration
    """
    # 1. Charger audio
    audio, sample_rate = load_audio(audio_path)
    
    # 2. Analyser spectre de fréquence
    spectrum = compute_spectrum(audio, sample_rate)
    
    # 3. Détecter pics d'énergie (beats)
    energy_peaks = detect_energy_peaks(spectrum)
    
    # 4. Filtrer et valider beats
    beats = validate_beats(energy_peaks, min_confidence=0.6)
    
    # 5. Calculer BPM
    bpm = calculate_bpm(beats)
    
    return beats, bpm

def sync_audio_video(
    video_transitions: List[float],
    audio_beats: List[Beat],
    tolerance: float = 0.1
) -> List[SyncPoint]:
    """
    Synchronise les transitions vidéo avec les beats audio
    """
    sync_points = []
    
    for transition_time in video_transitions:
        # Trouver le beat le plus proche
        closest_beat = find_closest_beat(audio_beats, transition_time, tolerance)
        
        if closest_beat:
            sync_points.append(SyncPoint(
                video_time=transition_time,
                audio_time=closest_beat.time,
                beat_time=closest_beat.time,
                sync_type="transition"
            ))
    
    return sync_points

def apply_audio_ducking(
    audio_path: str,
    dialogue_segments: List[Tuple[float, float]],
    duck_level: float = 0.3
) -> str:
    """
    Réduit le volume de la musique pendant les dialogues
    """
    # 1. Charger audio original
    audio, sample_rate = load_audio(audio_path)
    
    # 2. Créer enveloppe de ducking
    ducking_envelope = create_ducking_envelope(
        audio.duration,
        dialogue_segments,
        duck_level
    )
    
    # 3. Appliquer ducking
    ducked_audio = apply_envelope(audio, ducking_envelope)
    
    # 4. Sauvegarder
    output_path = save_audio(ducked_audio, sample_rate)
    
    return output_path
```

#### Intégration Frontend

```typescript
// mobile/src/services/audioSyncService.ts

export interface AudioSyncRequest {
  video_url: string;
  audio_url?: string;
  music_track_id?: number;
  beat_detection?: boolean;
  auto_ducking?: boolean;
  sync_with_transitions?: boolean;
  target_bpm?: number;
}

export interface Beat {
  time: number;
  confidence: number;
  strength: number;
}

export interface SyncPoint {
  video_time: number;
  audio_time: number;
  beat_time: number;
  sync_type: string;
}

export interface AudioSyncResponse {
  success: boolean;
  synced_audio_url: string;
  beats: Beat[];
  bpm: number;
  sync_points: SyncPoint[];
  ducking_segments: Array<{
    start_time: number;
    end_time: number;
    duck_level: number;
    reason: string;
  }>;
}

export const audioSyncService = {
  async syncAudio(request: AudioSyncRequest): Promise<AudioSyncResponse> {
    const response = await iaApi.post('/api/ia/video/audio-sync', request);
    if (!response.success) {
      throw new Error(response.error || 'Audio sync failed');
    }
    return response.data as AudioSyncResponse;
  },
};
```

#### Composant UI

```typescript
// mobile/src/components/AudioSyncPanel.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { audioSyncService, Beat, SyncPoint } from '../services/audioSyncService';
import { modernColors } from '../theme/modernTheme';

interface AudioSyncPanelProps {
  videoUrl: string;
  audioUrl?: string;
  musicTrackId?: number;
  onSyncComplete: (syncedAudioUrl: string, beats: Beat[]) => void;
}

export const AudioSyncPanel: React.FC<AudioSyncPanelProps> = ({
  videoUrl,
  audioUrl,
  musicTrackId,
  onSyncComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [beatDetection, setBeatDetection] = useState(true);
  const [autoDucking, setAutoDucking] = useState(true);
  const [syncWithTransitions, setSyncWithTransitions] = useState(true);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await audioSyncService.syncAudio({
        video_url: videoUrl,
        audio_url: audioUrl,
        music_track_id: musicTrackId,
        beat_detection: beatDetection,
        auto_ducking: autoDucking,
        sync_with_transitions: syncWithTransitions,
      });

      setBeats(result.beats);
      setBpm(result.bpm);
      onSyncComplete(result.synced_audio_url, result.beats);
    } catch (error) {
      console.error('[AudioSyncPanel] Error:', error);
      Alert.alert('Erreur', 'Impossible de synchroniser l\'audio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Synchronisation Audio-Vidéo</Text>

      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>Détection de beats</Text>
          <Text style={styles.optionDescription}>
            Synchronise les transitions avec le rythme musical
          </Text>
        </View>
        <Switch
          value={beatDetection}
          onValueChange={setBeatDetection}
          trackColor={{ true: modernColors.primary }}
        />
      </View>

      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>Audio ducking automatique</Text>
          <Text style={styles.optionDescription}>
            Réduit la musique pendant les dialogues
          </Text>
        </View>
        <Switch
          value={autoDucking}
          onValueChange={setAutoDucking}
          trackColor={{ true: modernColors.primary }}
        />
      </View>

      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>Sync avec transitions</Text>
          <Text style={styles.optionDescription}>
            Aligne les beats avec les changements de scène
          </Text>
        </View>
        <Switch
          value={syncWithTransitions}
          onValueChange={setSyncWithTransitions}
          trackColor={{ true: modernColors.primary }}
        />
      </View>

      <TouchableOpacity
        style={styles.syncButton}
        onPress={handleSync}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <SafeIcon name="music" size={20} color="#FFF" />
            <Text style={styles.syncButtonText}>Synchroniser</Text>
          </>
        )}
      </TouchableOpacity>

      {bpm && (
        <View style={styles.bpmInfo}>
          <Text style={styles.bpmLabel}>BPM détecté:</Text>
          <Text style={styles.bpmValue}>{bpm.toFixed(0)}</Text>
        </View>
      )}

      {beats.length > 0 && (
        <View style={styles.beatsInfo}>
          <Text style={styles.beatsLabel}>
            {beats.length} beats détectés
          </Text>
        </View>
      )}
    </View>
  );
};
```

### 2.4 Plan d'Implémentation

**Phase 1: Backend (1 semaine)**
1. Créer endpoint `/api/ia/video/audio-sync`
2. Implémenter beat detection (librosa ou équivalent Rust)
3. Implémenter sync audio-vidéo
4. Implémenter audio ducking
5. Tests unitaires

**Phase 2: Frontend (3 jours)**
1. Créer `audioSyncService.ts`
2. Créer composant `AudioSyncPanel.tsx`
3. Intégrer dans `ProductVideoCreationModal` (étape 5)
4. Tests UI

**Phase 3: Optimisation (2 jours)**
1. Cache des beats détectés
2. Progressive processing
3. Performance optimization

**Total**: 2 semaines

---

## 3. 🟡 Auto-Color Grading Avancé (Priorité Moyenne)

### 3.1 Description

Application automatique de color grading professionnel basé sur le style, l'ambiance, et les préférences.

### 3.2 Objectifs

- Qualité visuelle professionnelle automatique
- Adaptation par style (cinematic, vibrant, moody, etc.)
- Cohérence colorimétrique entre scènes
- Presets intelligents

### 3.3 Spécifications Techniques

#### Backend API Endpoint

```rust
// backend/src/routes/ia_routes.rs

#[derive(Serialize, Deserialize)]
pub struct ColorGradingRequest {
    pub media_url: String,
    pub media_id: Option<i32>,
    pub style_preset: Option<String>,     // "cinematic", "vibrant", "moody", "warm", "cool"
    pub target_mood: Option<String>,      // "energetic", "calm", "dramatic", "romantic"
    pub intensity: Option<f64>,           // 0.0-1.0, défaut: 0.7
    pub maintain_skin_tones: Option<bool>, // défaut: true
}

#[derive(Serialize, Deserialize)]
pub struct ColorGradingResponse {
    pub success: bool,
    pub graded_media_url: String,
    pub applied_preset: String,
    pub adjustments: ColorAdjustments,
    pub before_after_comparison: Option<String>, // URL thumbnail
}

#[derive(Serialize, Deserialize)]
pub struct ColorAdjustments {
    pub exposure: f64,        // -1.0 à 1.0
    pub contrast: f64,        // -1.0 à 1.0
    pub saturation: f64,      // -1.0 à 1.0
    pub highlights: f64,      // -1.0 à 1.0
    pub shadows: f64,         // -1.0 à 1.0
    pub temperature: f64,     // -1.0 (cool) à 1.0 (warm)
    pub tint: f64,            // -1.0 (green) à 1.0 (magenta)
    pub vibrance: f64,        // -1.0 à 1.0
}

// POST /api/ia/media/color-grade
pub async fn handle_color_grade(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ColorGradingRequest>,
) -> Result<Json<ColorGradingResponse>, StatusCode> {
    // 1. Analyser image/vidéo
    // 2. Déterminer preset optimal
    // 3. Appliquer color grading
    // 4. Retourner média traité
}
```

#### Presets de Color Grading

```python
# backend/src/services/color_grading_service.py

COLOR_GRADING_PRESETS = {
    "cinematic": {
        "exposure": 0.1,
        "contrast": 0.3,
        "saturation": -0.1,
        "highlights": -0.2,
        "shadows": 0.2,
        "temperature": 0.15,
        "tint": 0.05,
        "vibrance": 0.1,
    },
    "vibrant": {
        "exposure": 0.0,
        "contrast": 0.2,
        "saturation": 0.3,
        "highlights": -0.1,
        "shadows": 0.1,
        "temperature": 0.1,
        "tint": 0.0,
        "vibrance": 0.4,
    },
    "moody": {
        "exposure": -0.2,
        "contrast": 0.4,
        "saturation": -0.2,
        "highlights": -0.3,
        "shadows": 0.3,
        "temperature": -0.1,
        "tint": 0.1,
        "vibrance": -0.1,
    },
    "warm": {
        "exposure": 0.1,
        "contrast": 0.15,
        "saturation": 0.2,
        "highlights": -0.1,
        "shadows": 0.15,
        "temperature": 0.3,
        "tint": 0.05,
        "vibrance": 0.2,
    },
    "cool": {
        "exposure": 0.0,
        "contrast": 0.2,
        "saturation": 0.1,
        "highlights": -0.1,
        "shadows": 0.1,
        "temperature": -0.2,
        "tint": -0.05,
        "vibrance": 0.15,
    },
}

def apply_color_grading(
    media_path: str,
    preset: str,
    intensity: float = 0.7,
    maintain_skin_tones: bool = True
) -> str:
    """
    Applique un color grading à une image ou vidéo
    """
    # 1. Charger preset
    adjustments = COLOR_GRADING_PRESETS.get(preset, COLOR_GRADING_PRESETS["cinematic"])
    
    # 2. Ajuster selon intensité
    adjusted = {k: v * intensity for k, v in adjustments.items()}
    
    # 3. Détecter tons de peau si nécessaire
    if maintain_skin_tones:
        skin_mask = detect_skin_tones(media_path)
    else:
        skin_mask = None
    
    # 4. Appliquer avec FFmpeg ou PIL/OpenCV
    output_path = apply_adjustments(media_path, adjusted, skin_mask)
    
    return output_path
```

#### Intégration Frontend

```typescript
// mobile/src/services/colorGradingService.ts

export interface ColorGradingRequest {
  media_url: string;
  media_id?: number;
  style_preset?: 'cinematic' | 'vibrant' | 'moody' | 'warm' | 'cool';
  target_mood?: string;
  intensity?: number;
  maintain_skin_tones?: boolean;
}

export interface ColorAdjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
  vibrance: number;
}

export interface ColorGradingResponse {
  success: boolean;
  graded_media_url: string;
  applied_preset: string;
  adjustments: ColorAdjustments;
  before_after_comparison?: string;
}

export const colorGradingService = {
  async applyGrading(request: ColorGradingRequest): Promise<ColorGradingResponse> {
    const response = await iaApi.post('/api/ia/media/color-grade', request);
    if (!response.success) {
      throw new Error(response.error || 'Color grading failed');
    }
    return response.data as ColorGradingResponse;
  },
};
```

#### Composant UI

```typescript
// mobile/src/components/ColorGradingPanel.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { colorGradingService, ColorGradingResponse } from '../services/colorGradingService';
import { modernColors } from '../theme/modernTheme';

interface ColorGradingPanelProps {
  mediaUrl: string;
  mediaId?: number;
  stylePreset?: string;
  onGradingComplete: (gradedUrl: string) => void;
}

const GRADING_PRESETS = [
  { key: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { key: 'vibrant', label: 'Vibrant', icon: '🌈' },
  { key: 'moody', label: 'Moody', icon: '🌙' },
  { key: 'warm', label: 'Warm', icon: '☀️' },
  { key: 'cool', label: 'Cool', icon: '❄️' },
];

export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
  mediaUrl,
  mediaId,
  stylePreset,
  onGradingComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(stylePreset || 'cinematic');
  const [intensity, setIntensity] = useState(0.7);
  const [result, setResult] = useState<ColorGradingResponse | null>(null);

  const handleApplyGrading = async (preset: string) => {
    setLoading(true);
    try {
      const response = await colorGradingService.applyGrading({
        media_url: mediaUrl,
        media_id: mediaId,
        style_preset: preset,
        intensity,
        maintain_skin_tones: true,
      });

      setResult(response);
      onGradingComplete(response.graded_media_url);
    } catch (error) {
      console.error('[ColorGradingPanel] Error:', error);
      Alert.alert('Erreur', 'Impossible d\'appliquer le color grading');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Color Grading Automatique</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsList}>
        {GRADING_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.key}
            style={[
              styles.presetCard,
              selectedPreset === preset.key && styles.presetCardSelected,
            ]}
            onPress={() => {
              setSelectedPreset(preset.key);
              handleApplyGrading(preset.key);
            }}
            disabled={loading}
          >
            <Text style={styles.presetIcon}>{preset.icon}</Text>
            <Text style={styles.presetLabel}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={modernColors.primary} />
          <Text style={styles.loadingText}>Application du color grading...</Text>
        </View>
      )}

      {result && result.before_after_comparison && (
        <View style={styles.comparison}>
          <Text style={styles.comparisonTitle}>Avant / Après</Text>
          <Image
            source={{ uri: result.before_after_comparison }}
            style={styles.comparisonImage}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
};
```

### 3.4 Plan d'Implémentation

**Phase 1: Backend (1 semaine)**
1. Créer endpoint `/api/ia/media/color-grade`
2. Implémenter presets de color grading
3. Implémenter application avec FFmpeg/OpenCV
4. Détection de tons de peau
5. Tests unitaires

**Phase 2: Frontend (2 jours)**
1. Créer `colorGradingService.ts`
2. Créer composant `ColorGradingPanel.tsx`
3. Intégrer dans sélection médias (étape 2)
4. Tests UI

**Total**: 1.5 semaines

---

## 4. 🟡 Auto-Captions Avancé (Priorité Moyenne)

### 4.1 Description

Génération automatique de sous-titres depuis l'audio, avec styling intelligent et positionnement adaptatif.

### 4.2 Objectifs

- Accessibilité améliorée
- Engagement utilisateur (sous-titres = +40% engagement)
- Styling professionnel automatique
- Positionnement intelligent

### 4.3 Spécifications Techniques

#### Backend API Endpoint

```rust
// backend/src/routes/ia_routes.rs

#[derive(Serialize, Deserialize)]
pub struct AutoCaptionsRequest {
    pub video_url: String,
    pub audio_url: Option<String>,
    pub lang: Option<String>,            // défaut: "fr"
    pub style: Option<String>,            // "modern", "minimal", "bold", "elegant"
    pub position: Option<String>,        // "auto", "bottom", "top", "center"
    pub max_chars_per_line: Option<i32>,  // défaut: 42
    pub font_size: Option<f64>,           // défaut: 24.0
    pub background_opacity: Option<f64>,  // 0.0-1.0, défaut: 0.7
}

#[derive(Serialize, Deserialize)]
pub struct AutoCaptionsResponse {
    pub success: bool,
    pub subtitles: Vec<Subtitle>,
    pub subtitle_file_url: String,       // SRT/VTT
    pub styled_video_url: Option<String>, // Vidéo avec sous-titres intégrés
    pub confidence: f64,                  // 0.0-1.0
}

#[derive(Serialize, Deserialize)]
pub struct Subtitle {
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub confidence: f64,
    pub words: Vec<WordTiming>,          // Optionnel, pour word-level timing
}

#[derive(Serialize, Deserialize)]
pub struct WordTiming {
    pub word: String,
    pub start_time: f64,
    pub end_time: f64,
    pub confidence: f64,
}

// POST /api/ia/video/auto-captions
pub async fn handle_auto_captions(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AutoCaptionsRequest>,
) -> Result<Json<AutoCaptionsResponse>, StatusCode> {
    // 1. Extraire audio de la vidéo
    // 2. Speech-to-Text (Whisper ou équivalent)
    // 3. Générer sous-titres avec timing
    // 4. Appliquer styling
    // 5. Positionner intelligemment
    // 6. Générer fichier SRT/VTT
    // 7. Optionnel: Intégrer dans vidéo
}
```

#### Algorithme de Génération

```python
# backend/src/services/captions_service.py

def generate_captions(
    video_path: str,
    lang: str = "fr",
    model: str = "whisper-large"
) -> List[Subtitle]:
    """
    Génère des sous-titres depuis l'audio de la vidéo
    """
    # 1. Extraire audio
    audio_path = extract_audio(video_path)
    
    # 2. Speech-to-Text avec Whisper
    transcription = whisper_transcribe(audio_path, lang=lang, model=model)
    
    # 3. Segmenter en sous-titres (respecter max_chars_per_line)
    subtitles = segment_transcription(transcription, max_chars=42)
    
    # 4. Ajuster timing pour fluidité
    subtitles = adjust_timing(subtitles, min_duration=1.0, max_duration=7.0)
    
    return subtitles

def apply_subtitle_style(
    video_path: str,
    subtitles: List[Subtitle],
    style: str = "modern"
) -> str:
    """
    Applique un style aux sous-titres et les intègre dans la vidéo
    """
    # Styles disponibles
    styles = {
        "modern": {
            "font": "Arial Bold",
            "font_size": 24,
            "color": "#FFFFFF",
            "outline_color": "#000000",
            "outline_width": 2,
            "background_color": "rgba(0,0,0,0.7)",
            "position": "bottom",
            "margin": 40,
        },
        "minimal": {
            "font": "Helvetica",
            "font_size": 20,
            "color": "#FFFFFF",
            "outline_color": "none",
            "background_color": "none",
            "position": "bottom",
            "margin": 20,
        },
        "bold": {
            "font": "Impact",
            "font_size": 28,
            "color": "#FFFFFF",
            "outline_color": "#000000",
            "outline_width": 3,
            "background_color": "rgba(0,0,0,0.8)",
            "position": "center",
            "margin": 0,
        },
        "elegant": {
            "font": "Georgia",
            "font_size": 22,
            "color": "#F5F5F5",
            "outline_color": "#2C2C2C",
            "outline_width": 1,
            "background_color": "rgba(20,20,20,0.6)",
            "position": "bottom",
            "margin": 50,
        },
    }
    
    style_config = styles.get(style, styles["modern"])
    
    # Appliquer avec FFmpeg
    output_path = apply_subtitles_ffmpeg(video_path, subtitles, style_config)
    
    return output_path

def intelligent_positioning(
    video_path: str,
    subtitles: List[Subtitle]
) -> List[Subtitle]:
    """
    Positionne intelligemment les sous-titres pour éviter les zones importantes
    """
    for subtitle in subtitles:
        # Analyser frame au moment du sous-titre
        frame = extract_frame(video_path, subtitle.start_time)
        
        # Détecter zones importantes (visages, texte, logos)
        important_zones = detect_important_zones(frame)
        
        # Choisir position (top/bottom/center) qui évite ces zones
        subtitle.position = choose_best_position(important_zones)
    
    return subtitles
```

#### Intégration Frontend

```typescript
// mobile/src/services/captionsService.ts

export interface AutoCaptionsRequest {
  video_url: string;
  audio_url?: string;
  lang?: string;
  style?: 'modern' | 'minimal' | 'bold' | 'elegant';
  position?: 'auto' | 'bottom' | 'top' | 'center';
  max_chars_per_line?: number;
  font_size?: number;
  background_opacity?: number;
}

export interface Subtitle {
  start_time: number;
  end_time: number;
  text: string;
  confidence: number;
  words?: Array<{
    word: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }>;
}

export interface AutoCaptionsResponse {
  success: boolean;
  subtitles: Subtitle[];
  subtitle_file_url: string;
  styled_video_url?: string;
  confidence: number;
}

export const captionsService = {
  async generateCaptions(request: AutoCaptionsRequest): Promise<AutoCaptionsResponse> {
    const response = await iaApi.post('/api/ia/video/auto-captions', request);
    if (!response.success) {
      throw new Error(response.error || 'Caption generation failed');
    }
    return response.data as AutoCaptionsResponse;
  },
};
```

#### Composant UI

```typescript
// mobile/src/components/AutoCaptionsPanel.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { captionsService, Subtitle } from '../services/captionsService';
import { modernColors } from '../theme/modernTheme';

interface AutoCaptionsPanelProps {
  videoUrl: string;
  lang?: string;
  onCaptionsGenerated: (subtitles: Subtitle[], subtitleFileUrl: string) => void;
}

const CAPTION_STYLES = [
  { key: 'modern', label: 'Moderne', description: 'Style classique avec fond' },
  { key: 'minimal', label: 'Minimal', description: 'Sans fond, épuré' },
  { key: 'bold', label: 'Bold', description: 'Gras, centré, impactant' },
  { key: 'elegant', label: 'Élégant', description: 'Raffiné, discret' },
];

export const AutoCaptionsPanel: React.FC<AutoCaptionsPanelProps> = ({
  videoUrl,
  lang = 'fr',
  onCaptionsGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await captionsService.generateCaptions({
        video_url: videoUrl,
        lang,
        style: selectedStyle,
        position: 'auto',
      });

      setSubtitles(result.subtitles);
      setConfidence(result.confidence);
      onCaptionsGenerated(result.subtitles, result.subtitle_file_url);
    } catch (error) {
      console.error('[AutoCaptionsPanel] Error:', error);
      Alert.alert('Erreur', 'Impossible de générer les sous-titres');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sous-titres Automatiques</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stylesList}>
        {CAPTION_STYLES.map((style) => (
          <TouchableOpacity
            key={style.key}
            style={[
              styles.styleCard,
              selectedStyle === style.key && styles.styleCardSelected,
            ]}
            onPress={() => setSelectedStyle(style.key)}
          >
            <Text style={styles.styleLabel}>{style.label}</Text>
            <Text style={styles.styleDescription}>{style.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <SafeIcon name="closed-captioning" size={20} color="#FFF" />
            <Text style={styles.generateButtonText}>Générer les sous-titres</Text>
          </>
        )}
      </TouchableOpacity>

      {confidence !== null && (
        <View style={styles.confidenceInfo}>
          <Text style={styles.confidenceLabel}>
            Confiance: {(confidence * 100).toFixed(0)}%
          </Text>
        </View>
      )}

      {subtitles.length > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Aperçu ({subtitles.length} sous-titres)</Text>
          <ScrollView style={styles.subtitlesList}>
            {subtitles.slice(0, 5).map((subtitle, index) => (
              <View key={index} style={styles.subtitleItem}>
                <Text style={styles.subtitleTime}>
                  {formatTime(subtitle.start_time)} - {formatTime(subtitle.end_time)}
                </Text>
                <Text style={styles.subtitleText}>{subtitle.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};
```

### 4.4 Plan d'Implémentation

**Phase 1: Backend (1 semaine)**
1. Créer endpoint `/api/ia/video/auto-captions`
2. Intégrer Whisper (ou équivalent) pour STT
3. Implémenter génération de sous-titres
4. Implémenter styling
5. Implémenter positionnement intelligent
6. Tests unitaires

**Phase 2: Frontend (2 jours)**
1. Créer `captionsService.ts`
2. Créer composant `AutoCaptionsPanel.tsx`
3. Intégrer dans `ProductVideoCreationModal` (étape 4 ou 6)
4. Tests UI

**Total**: 1.5 semaines

---

## 📊 Plan d'Implémentation Global

### Priorité 1 (4 semaines)
1. Auto-Cut Intelligent (2 semaines)
2. Synchronisation Audio-Vidéo (2 semaines)

### Priorité 2 (3 semaines)
3. Auto-Color Grading (1.5 semaines)
4. Auto-Captions Avancé (1.5 semaines)

**Total**: 7 semaines pour les 4 fonctionnalités

---

## 🎯 Métriques de Succès

### Auto-Cut
- Temps de découpage réduit de 70%
- Précision détection scènes >85%
- Détection highlights >80%

### Audio Sync
- Synchronisation précision <100ms
- Beat detection précision >90%
- Audio ducking naturel (imperceptible)

### Color Grading
- Qualité professionnelle (score >8/10)
- Temps traitement <30s par média
- Satisfaction utilisateur >4.5/5

### Auto-Captions
- Précision transcription >95%
- Temps génération <60s pour 1min vidéo
- Accessibilité améliorée (WCAG AA)

---

**Conclusion**: Ces 4 fonctionnalités transformeront Yukpomnang en leader de la création vidéo assistée par IA, avec un avantage concurrentiel significatif.

