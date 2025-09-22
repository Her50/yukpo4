import { useCallback, useEffect, useState } from 'react';
import { useUser } from './useUser';

interface VideoCallNotification {
    id: string;
    fromUserId: number;
    fromUserName: string;
    serviceId: string;
    timestamp: Date;
    status: 'ringing' | 'answered' | 'declined' | 'missed';
}

export const useVideoCallNotifications = () => {
    const [incomingCalls, setIncomingCalls] = useState<VideoCallNotification[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const { user } = useUser();

    // Fonction pour ajouter un appel entrant
    const addIncomingCall = useCallback((call: Omit<VideoCallNotification, 'id' | 'timestamp'>) => {
        const newCall: VideoCallNotification = {
            ...call,
            id: `call_${Date.now()}_${call.fromUserId}`,
            timestamp: new Date(),
            status: 'ringing'
        };

        setIncomingCalls(prev => [newCall, ...prev]);

        // Jouer le son de notification
        playCallSound();

        // Notification du navigateur
        if (Notification.permission === 'granted') {
            new Notification('Appel vidéo entrant', {
                body: `${call.fromUserName} vous appelle`,
                icon: '/favicon.ico',
                tag: `call_${call.fromUserId}`
            });
        }
    }, []);

    // Fonction pour répondre à un appel
    const answerCall = useCallback((callId: string) => {
        setIncomingCalls(prev =>
            prev.map(call =>
                call.id === callId
                    ? { ...call, status: 'answered' }
                    : call
            )
        );
        stopCallSound();
    }, []);

    // Fonction pour refuser un appel
    const declineCall = useCallback((callId: string) => {
        setIncomingCalls(prev =>
            prev.map(call =>
                call.id === callId
                    ? { ...call, status: 'declined' }
                    : call
            )
        );
        stopCallSound();
    }, []);

    // Fonction pour marquer un appel comme manqué
    const markAsMissed = useCallback((callId: string) => {
        setIncomingCalls(prev =>
            prev.map(call =>
                call.id === callId
                    ? { ...call, status: 'missed' }
                    : call
            )
        );
        stopCallSound();
    }, []);

    // Fonction pour supprimer un appel
    const removeCall = useCallback((callId: string) => {
        setIncomingCalls(prev => prev.filter(call => call.id !== callId));
    }, []);

    // Fonction pour jouer le son d'appel
    const playCallSound = useCallback(() => {
        try {
            // Créer un son d'appel avec Web Audio API (compatible mobile)
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // S'assurer que le contexte audio est en état "running" (requis sur mobile)
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const createTone = (frequency: number, duration: number, startTime: number) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(frequency, startTime);
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };

            // Créer un pattern d'appel téléphonique
            const playRing = () => {
                const now = audioContext.currentTime;
                createTone(800, 0.5, now);
                createTone(800, 0.5, now + 0.6);
                createTone(800, 0.5, now + 1.2);
                createTone(800, 0.5, now + 1.8);
            };

            // Jouer le son en boucle
            playRing();
            const interval = setInterval(playRing, 2000);

            // Arrêter après 30 secondes
            setTimeout(() => {
                clearInterval(interval);
            }, 30000);

        } catch (error) {
            console.error('Erreur lecture son appel:', error);
            // Fallback: utiliser un bip simple
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBS13yO/eizEIHWq+8+OWT');
                audio.loop = true;
                audio.volume = 0.3;
                audio.play().catch(console.error);
            } catch (fallbackError) {
                console.error('Erreur fallback son appel:', fallbackError);
            }
        }
    }, []);

    // Fonction pour arrêter le son d'appel
    const stopCallSound = useCallback(() => {
        try {
            const audio = document.querySelector('audio[src="/sounds/phone-ring.mp3"]') as HTMLAudioElement;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        } catch (error) {
            console.error('Erreur arrêt son appel:', error);
        }
    }, []);

    // Demander la permission de notification
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Simuler la connexion WebSocket
    useEffect(() => {
        if (user?.id) {
            setIsConnected(true);

            // Simuler un appel entrant pour test (à supprimer en production)
            if (import.meta.env.DEV) {
                setTimeout(() => {
                    addIncomingCall({
                        fromUserId: 999,
                        fromUserName: 'Test User',
                        serviceId: 'test-service',
                        status: 'ringing'
                    });
                }, 5000);
            }
        }
    }, [user?.id, addIncomingCall]);

    return {
        incomingCalls,
        isConnected,
        addIncomingCall,
        answerCall,
        declineCall,
        markAsMissed,
        removeCall,
        playCallSound,
        stopCallSound
    };
};
