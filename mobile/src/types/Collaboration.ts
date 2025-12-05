// ✅ NOUVEAU Phase 2.4: Types pour collaboration en temps réel

export interface Collaborator {
    userId: string;
    username: string;
    avatarUrl?: string;
    color: string; // Couleur pour identifier le collaborateur
    isActive: boolean;
    lastSeen: number; // timestamp
}

export interface CollaborationCursor {
    userId: string;
    position: {
        x: number;
        y: number;
    };
    timestamp: number;
}

export interface CollaborationAction {
    id: string;
    userId: string;
    type: 'clip_added' | 'clip_deleted' | 'clip_moved' | 'effect_applied' | 'text_changed' | 'keyframe_updated';
    timelineId: string;
    data: Record<string, any>;
    timestamp: number;
}

export interface CollaborationSession {
    sessionId: string;
    timelineId: string;
    ownerId: string;
    collaborators: Collaborator[];
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface CollaborationMessage {
    type: 'join' | 'leave' | 'cursor_move' | 'action' | 'sync' | 'conflict' | 'ping' | 'pong';
    userId: string;
    sessionId: string;
    data?: any;
    timestamp: number;
}

export interface CollaborationConflict {
    conflictId: string;
    userId: string;
    action: CollaborationAction;
    resolution: 'last-write-wins' | 'merge' | 'manual';
    resolvedAt?: number;
}

