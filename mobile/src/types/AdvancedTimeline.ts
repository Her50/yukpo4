// ✅ NOUVEAU Phase 2: Types pour Timeline Multi-Pistes avec Keyframes

/**
 * Type de piste dans la timeline
 */
export type TrackType = 'video' | 'audio' | 'text' | 'effect' | 'graphic' | 'image';

/**
 * Propriété animable avec keyframes
 */
export interface AnimatableProperty {
    position?: Keyframe[];
    scale?: Keyframe[];
    rotation?: Keyframe[];
    opacity?: Keyframe[];
    color?: Keyframe[];
    blur?: Keyframe[];
    brightness?: Keyframe[];
    contrast?: Keyframe[];
    saturation?: Keyframe[];
}

/**
 * Keyframe pour animation
 */
export interface Keyframe {
    time: number; // Temps en secondes
    value: number | [number, number] | [number, number, number] | [number, number, number, number]; // Valeur selon le type
    easing?: EasingType;
    interpolation?: InterpolationType;
}

/**
 * Type d'interpolation pour keyframes
 */
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';

/**
 * Type d'interpolation
 */
export type InterpolationType = 'linear' | 'bezier' | 'hold';

/**
 * Courbe de Bézier pour animation
 */
export interface BezierCurve {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/**
 * Clip média sur une piste
 */
export interface TimelineClip {
    id: string;
    type: TrackType;
    startTime: number; // Temps de début dans la timeline
    duration: number; // Durée du clip
    source: string; // URL ou chemin du média
    properties: AnimatableProperty;
    trimStart?: number; // Trim de début (si clip découpé)
    trimEnd?: number; // Trim de fin
    volume?: number; // Volume (pour audio/vidéo)
    muted?: boolean;
    locked?: boolean; // Clip verrouillé (non éditable)
    visible?: boolean; // Clip visible/invisible
}

/**
 * Piste dans la timeline
 */
export interface TimelineTrack {
    id: string;
    type: TrackType;
    name: string;
    clips: TimelineClip[];
    locked?: boolean; // Piste verrouillée
    muted?: boolean; // Piste muette
    visible?: boolean; // Piste visible/invisible
    height?: number; // Hauteur de la piste en pixels
    order: number; // Ordre d'affichage (pour superposition)
}

/**
 * Timeline multi-pistes complète
 */
export interface AdvancedTimeline {
    id: string;
    name: string;
    duration: number; // Durée totale en secondes
    tracks: TimelineTrack[];
    fps: number; // Frames par seconde (24, 30, 60)
    resolution: {
        width: number;
        height: number;
    };
    backgroundColor?: string;
    audioSampleRate?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Paramètres de zoom/pan de la timeline
 */
export interface TimelineViewport {
    zoom: number; // Niveau de zoom (1 = 1 pixel par seconde)
    offsetX: number; // Décalage horizontal
    offsetY: number; // Décalage vertical
    visibleStartTime: number; // Temps visible au début
    visibleEndTime: number; // Temps visible à la fin
}

/**
 * État de la timeline pendant l'édition
 */
export interface TimelineState {
    currentTime: number; // Temps actuel de lecture
    isPlaying: boolean;
    isScrubbing: boolean;
    selectedClips: string[]; // IDs des clips sélectionnés
    selectedTracks: string[]; // IDs des pistes sélectionnées
    viewport: TimelineViewport;
    snapEnabled: boolean; // Magnétisme activé
    snapThreshold: number; // Distance de snap en pixels
}

/**
 * Action d'édition sur la timeline
 */
export interface TimelineAction {
    type: 'move' | 'trim' | 'split' | 'delete' | 'add' | 'update';
    clipId: string;
    trackId: string;
    data: any;
    timestamp: number;
}

/**
 * Historique d'actions (pour undo/redo)
 */
export interface TimelineHistory {
    actions: TimelineAction[];
    currentIndex: number;
    maxHistorySize: number;
}

/**
 * Propriétés d'effet pour un clip
 */
export interface EffectProperties {
    type: string; // Type d'effet (fade, blur, etc.)
    enabled: boolean;
    parameters: Record<string, number | string>;
    keyframes?: Keyframe[];
}

/**
 * Transition entre deux clips
 */
export interface Transition {
    type: 'fade' | 'slide' | 'zoom' | 'wipe' | 'dissolve';
    duration: number;
    parameters?: Record<string, number>;
}

/**
 * Guide de synchronisation (snap guides)
 */
export interface SnapGuide {
    time: number;
    type: 'clip-start' | 'clip-end' | 'playhead' | 'custom';
    clipId?: string;
}

