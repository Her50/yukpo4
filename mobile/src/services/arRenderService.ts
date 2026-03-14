// @ts-nocheck
// ✅ NOUVEAU Phase 3.2: Service de rendu AR pour édition vidéo

import { apiCall } from './api';

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Vector2 {
    x: number;
    y: number;
}

export interface ARClip3D {
    clip_id: string;
    video_url: string;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    start_time: number;
    duration: number;
}

export interface ARScene3D {
    scene_id: string;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    clips: ARClip3D[];
}

export interface ARPlane {
    plane_id: string;
    center: Vector3;
    normal: Vector3;
    extent: Vector2;
}

export interface ARTrackingState {
    is_tracking: boolean;
    tracking_quality: number; // 0.0 - 1.0
    camera_position: Vector3;
    camera_rotation: Vector3;
    detected_planes: ARPlane[];
}

export interface ARPreviewRequest {
    timeline_id: string;
    viewport_width: number;
    viewport_height: number;
    camera_position: Vector3;
    camera_rotation: Vector3;
}

export interface ARPreviewResponse {
    preview_url: string;
    thumbnail_url: string;
    scene_data: ARScene3D;
}

export const arRenderService = {
    /**
     * Génère une preview 3D pour AR à partir d'une timeline
     */
    async generateARPreview(request: ARPreviewRequest): Promise<ARPreviewResponse> {
        const response = await apiCall<ARPreviewResponse>('/api/ar/preview', {
            method: 'POST',
            body: JSON.stringify(request),
        });
        return response;
    },

    /**
     * Valide l'état de tracking AR
     */
    validateTrackingState(trackingState: ARTrackingState): boolean {
        return trackingState.is_tracking && trackingState.tracking_quality >= 0.5;
    },
};

