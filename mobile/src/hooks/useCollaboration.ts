// ✅ NOUVEAU Phase 2.4: Hook React pour collaboration en temps réel

import { useEffect, useRef, useState } from 'react';
import { collaborationService } from '../services/collaborationService';
import {
    CollaborationAction,
    CollaborationCursor,
    CollaborationMessage,
    Collaborator,
} from '../types/Collaboration';

interface UseCollaborationOptions {
    sessionId: string | null;
    userId: string | null;
    enabled?: boolean;
}

export const useCollaboration = (options: UseCollaborationOptions) => {
    const { sessionId, userId, enabled = true } = options;
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [cursors, setCursors] = useState<Map<string, CollaborationCursor>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [recentActions, setRecentActions] = useState<CollaborationAction[]>([]);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!enabled || !sessionId || !userId) {
            return;
        }

        // Se connecter
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        collaborationService
            .connect(sessionId, userId, (message) => {
                handleMessage(message);
            })
            .then(() => {
                setIsConnected(true);
            })
            .catch((error) => {
                console.error('[useCollaboration] Erreur connexion:', error);
                setIsConnected(false);
            });

        // Configurer les handlers
        const handleJoin = (data: any) => {
            if (data.collaborator) {
                setCollaborators((prev) => {
                    const exists = prev.some((c) => c.userId === data.collaborator.userId);
                    if (exists) {
                        return prev.map((c) =>
                            c.userId === data.collaborator.userId ? data.collaborator : c
                        );
                    }
                    return [...prev, data.collaborator];
                });
            }
        };

        const handleLeave = (data: any) => {
            if (data.userId) {
                setCollaborators((prev) => prev.filter((c) => c.userId !== data.userId));
                setCursors((prev) => {
                    const next = new Map(prev);
                    next.delete(data.userId);
                    return next;
                });
            }
        };

        const handleCursorMove = (data: CollaborationCursor) => {
            setCursors((prev) => {
                const next = new Map(prev);
                next.set(data.userId, data);
                return next;
            });
        };

        const handleAction = (data: CollaborationAction) => {
            setRecentActions((prev) => {
                const updated = [data, ...prev].slice(0, 50); // Garder les 50 dernières actions
                return updated;
            });
        };

        collaborationService.on('join', handleJoin);
        collaborationService.on('leave', handleLeave);
        collaborationService.on('cursor_move', handleCursorMove);
        collaborationService.on('action', handleAction);

        // Ping périodique pour maintenir la connexion
        pingIntervalRef.current = setInterval(() => {
            collaborationService.ping();
        }, 30000); // Ping toutes les 30 secondes

        return () => {
            // Nettoyage
            collaborationService.off('join', handleJoin);
            collaborationService.off('leave', handleLeave);
            collaborationService.off('cursor_move', handleCursorMove);
            collaborationService.off('action', handleAction);
            collaborationService.disconnect();
            setIsConnected(false);

            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, [enabled, sessionId, userId]);

    const handleMessage = (message: CollaborationMessage) => {
        switch (message.type) {
            case 'join':
                // Handler déjà configuré via on()
                break;
            case 'leave':
                // Handler déjà configuré via on()
                break;
            case 'cursor_move':
                // Handler déjà configuré via on()
                break;
            case 'action':
                // Handler déjà configuré via on()
                break;
            case 'pong':
                // Réponse au ping, rien à faire
                break;
            default:
                console.log('[useCollaboration] Message type non géré:', message.type);
        }
    };

    const publishAction = (action: CollaborationAction) => {
        collaborationService.publishAction(action);
    };

    const publishCursorMove = (cursor: CollaborationCursor) => {
        collaborationService.publishCursorMove(cursor);
    };

    return {
        collaborators,
        cursors,
        isConnected,
        recentActions,
        publishAction,
        publishCursorMove,
    };
};

