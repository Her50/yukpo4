// ✅ NOUVEAU Phase 3.2 Intégration Native: Service de tracking AR avec packages natifs

import { Platform } from 'react-native';
import { ARPlane, ARTrackingState } from './arRenderService';

// Types pour le tracking AR natif
export interface ARCameraPose {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    projectionMatrix: number[];
    viewMatrix: number[];
}

export interface ARAnchor {
    anchorId: string;
    transform: number[]; // 4x4 matrix
    type: 'plane' | 'image' | 'object' | 'face';
}

export interface ARFrame {
    timestamp: number;
    cameraPose: ARCameraPose;
    anchors: ARAnchor[];
    lightingEstimate?: {
        ambientIntensity: number;
        ambientColorTemperature: number;
    };
}

/**
 * Service de tracking AR avec intégration native
 * Supporte ARKit (iOS) et ARCore (Android)
 */
export class ARTrackingServiceNative {
    private isTracking = false;
    private trackingQuality = 0;
    private detectedPlanes: ARPlane[] = [];
    private onTrackingUpdate?: (state: ARTrackingState) => void;
    private arkitModule: any = null;
    private arcoreModule: any = null;

    constructor() {
        this.initializeNativeModules();
    }

    /**
     * Initialise les modules AR natifs
     */
    private async initializeNativeModules(): Promise<void> {
        try {
            if (Platform.OS === 'ios') {
                // Dynamiquement importer react-native-arkit si disponible
                try {
                    this.arkitModule = require('react-native-arkit');
                    console.log('[ARTracking] Module ARKit chargé');
                } catch (e) {
                    console.warn('[ARTracking] Module ARKit non disponible, utilisation simulation');
                }
            } else if (Platform.OS === 'android') {
                // Dynamiquement importer react-native-arcore si disponible
                try {
                    this.arcoreModule = require('react-native-arcore');
                    console.log('[ARTracking] Module ARCore chargé');
                } catch (e) {
                    console.warn('[ARTracking] Module ARCore non disponible, utilisation simulation');
                }
            }
        } catch (error) {
            console.error('[ARTracking] Erreur initialisation modules natifs:', error);
        }
    }

    /**
     * Initialise le tracking AR (ARKit ou ARCore selon la plateforme)
     */
    async initialize(): Promise<boolean> {
        try {
            if (Platform.OS === 'ios') {
                return await this.initializeARKit();
            } else if (Platform.OS === 'android') {
                return await this.initializeARCore();
            }
            return false;
        } catch (error) {
            console.error('[ARTracking] Erreur initialisation:', error);
            return false;
        }
    }

    /**
     * Initialise ARKit pour iOS
     */
    private async initializeARKit(): Promise<boolean> {
        if (this.arkitModule) {
            try {
                // Utiliser le module natif ARKit
                await this.arkitModule.init();
                await this.arkitModule.start();

                // Configurer les callbacks
                this.arkitModule.onFrameUpdate((frame: any) => {
                    this.processARKitFrame(frame);
                });

                this.isTracking = true;
                this.trackingQuality = 0.9;
                console.log('[ARTracking] ARKit initialisé avec module natif');
                return true;
            } catch (error) {
                console.error('[ARTracking] Erreur initialisation ARKit native:', error);
                return this.initializeARKitFallback();
            }
        }

        return this.initializeARKitFallback();
    }

    /**
     * Fallback ARKit (simulation)
     */
    private async initializeARKitFallback(): Promise<boolean> {
        console.log('[ARTracking] Initialisation ARKit (fallback simulation)...');

        // Simulation
        setTimeout(() => {
            this.isTracking = true;
            this.trackingQuality = 0.8;
            this.updateTrackingState();
        }, 1000);

        return true;
    }

    /**
     * Initialise ARCore pour Android
     */
    private async initializeARCore(): Promise<boolean> {
        if (this.arcoreModule) {
            try {
                // Utiliser le module natif ARCore
                await this.arcoreModule.start();

                // Configurer les callbacks
                this.arcoreModule.onFrameUpdate((frame: any) => {
                    this.processARCoreFrame(frame);
                });

                this.isTracking = true;
                this.trackingQuality = 0.85;
                console.log('[ARTracking] ARCore initialisé avec module natif');
                return true;
            } catch (error) {
                console.error('[ARTracking] Erreur initialisation ARCore native:', error);
                return this.initializeARCoreFallback();
            }
        }

        return this.initializeARCoreFallback();
    }

    /**
     * Fallback ARCore (simulation)
     */
    private async initializeARCoreFallback(): Promise<boolean> {
        console.log('[ARTracking] Initialisation ARCore (fallback simulation)...');

        // Simulation
        setTimeout(() => {
            this.isTracking = true;
            this.trackingQuality = 0.75;
            this.updateTrackingState();
        }, 1500);

        return true;
    }

    /**
     * Traite une frame ARKit
     */
    private processARKitFrame(frame: any): void {
        // Convertir la frame ARKit en format standard
        const arFrame: ARFrame = {
            timestamp: frame.timestamp || Date.now(),
            cameraPose: {
                position: frame.cameraPosition || { x: 0, y: 0, z: 0 },
                rotation: frame.cameraRotation || { x: 0, y: 0, z: 0, w: 1 },
                projectionMatrix: frame.projectionMatrix || [],
                viewMatrix: frame.viewMatrix || [],
            },
            anchors: (frame.anchors || []).map((anchor: any) => ({
                anchorId: anchor.identifier || anchor.anchorId,
                transform: anchor.transform || [],
                type: anchor.type || 'plane',
            })),
            lightingEstimate: frame.lightingEstimate,
        };

        this.processARFrame(arFrame);
    }

    /**
     * Traite une frame ARCore
     */
    private processARCoreFrame(frame: any): void {
        // Convertir la frame ARCore en format standard
        const arFrame: ARFrame = {
            timestamp: frame.timestamp || Date.now(),
            cameraPose: {
                position: frame.cameraPose?.position || { x: 0, y: 0, z: 0 },
                rotation: frame.cameraPose?.rotation || { x: 0, y: 0, z: 0, w: 1 },
                projectionMatrix: frame.projectionMatrix || [],
                viewMatrix: frame.viewMatrix || [],
            },
            anchors: (frame.trackables || []).map((trackable: any) => ({
                anchorId: trackable.id || trackable.anchorId,
                transform: trackable.pose?.matrix || [],
                type: 'plane', // ARCore détecte principalement des plans
            })),
            lightingEstimate: frame.lightEstimate,
        };

        this.processARFrame(arFrame);
    }

    /**
     * Traite une frame AR standard
     */
    private processARFrame(frame: ARFrame): void {
        if (!this.isTracking) return;

        // Analyser la frame pour détecter les plans
        this.detectPlanes(frame.anchors);

        // Mettre à jour la qualité du tracking
        this.updateTrackingQuality(frame);

        // Mettre à jour la position/rotation de la caméra
        this.cameraPosition = frame.cameraPose.position;
        this.cameraRotation = {
            x: frame.cameraPose.rotation.x,
            y: frame.cameraPose.rotation.y,
            z: frame.cameraPose.rotation.z,
        };

        // Notifier les listeners
        this.updateTrackingState();
    }

    private cameraPosition = { x: 0, y: 0, z: 0 };
    private cameraRotation = { x: 0, y: 0, z: 0 };

    /**
     * Détecte les plans dans une frame AR
     */
    private detectPlanes(anchors: ARAnchor[]): void {
        const planes: ARPlane[] = [];

        for (const anchor of anchors) {
            if (anchor.type === 'plane') {
                const transform = anchor.transform;

                const center = {
                    x: transform[12] || 0,
                    y: transform[13] || 0,
                    z: transform[14] || 0,
                };

                const normal = {
                    x: transform[8] || 0,
                    y: transform[9] || 0,
                    z: transform[10] || 1,
                };

                planes.push({
                    plane_id: anchor.anchorId,
                    center,
                    normal,
                    extent: { x: 1.0, y: 1.0 },
                });
            }
        }

        this.detectedPlanes = planes;
    }

    /**
     * Met à jour la qualité du tracking
     */
    private updateTrackingQuality(frame: ARFrame): void {
        const anchorCount = frame.anchors.length;
        const baseQuality = Math.min(1.0, anchorCount / 5.0);

        if (frame.lightingEstimate) {
            const lightFactor = Math.min(1.0, frame.lightingEstimate.ambientIntensity / 1000.0);
            this.trackingQuality = baseQuality * 0.7 + lightFactor * 0.3;
        } else {
            this.trackingQuality = baseQuality;
        }
    }

    /**
     * Met à jour l'état du tracking
     */
    private updateTrackingState(): void {
        if (!this.onTrackingUpdate) return;

        const state: ARTrackingState = {
            is_tracking: this.isTracking,
            tracking_quality: this.trackingQuality,
            camera_position: this.cameraPosition,
            camera_rotation: this.cameraRotation,
            detected_planes: this.detectedPlanes,
        };

        this.onTrackingUpdate(state);
    }

    /**
     * Démarre le tracking AR
     */
    async startTracking(): Promise<void> {
        if (this.isTracking) {
            console.warn('[ARTracking] Tracking déjà actif');
            return;
        }

        const initialized = await this.initialize();
        if (!initialized) {
            throw new Error('Impossible d\'initialiser le tracking AR');
        }
    }

    /**
     * Arrête le tracking AR
     */
    stopTracking(): void {
        if (this.arkitModule) {
            this.arkitModule.stop().catch(console.error);
        }
        if (this.arcoreModule) {
            this.arcoreModule.stop().catch(console.error);
        }

        this.isTracking = false;
        this.trackingQuality = 0;
        this.detectedPlanes = [];
        this.updateTrackingState();
    }

    /**
     * Définit un callback pour les mises à jour du tracking
     */
    setOnTrackingUpdate(callback: (state: ARTrackingState) => void): void {
        this.onTrackingUpdate = callback;
    }

    /**
     * Obtient l'état actuel du tracking
     */
    getTrackingState(): ARTrackingState {
        return {
            is_tracking: this.isTracking,
            tracking_quality: this.trackingQuality,
            camera_position: this.cameraPosition,
            camera_rotation: this.cameraRotation,
            detected_planes: this.detectedPlanes,
        };
    }
}

export const arTrackingServiceNative = new ARTrackingServiceNative();

