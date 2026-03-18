/**
 * Composant player pour live streaming HLS
 * Supporte HLS natif pour streaming en direct
 */

import { ResizeMode, Video } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiveJoinInformationRecord, liveStreamingService } from '../../services/liveStreamingService';
import SafeIcon from '../SafeIcon';
import { LiveChatModal } from './LiveChatModal';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface LiveStreamPlayerProps {
    sessionId: string;
    userId?: number;
    onError?: (error: Error) => void;
    onLoadStart?: () => void;
    onLoad?: () => void;
    autoPlay?: boolean;
}

export const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
    sessionId,
    userId,
    onError,
    onLoadStart,
    onLoad,
    autoPlay = true,
}) => {
    const videoRef = useRef<Video>(null);
        const { t } = useLanguageSafe();
const [hlsUrl, setHlsUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joinInfo, setJoinInfo] = useState<LiveJoinInformationRecord | null>(null);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        loadLiveStream();
    }, [sessionId, userId]);

    const loadLiveStream = async () => {
        try {
            setLoading(true);
            setError(null);
            onLoadStart?.();

            // Récupérer les informations de connexion
            const response = await liveStreamingService.getJoinInformation(sessionId, {
                viewer_user_id: userId,
                allow_publish: false,
            });

            const info = (response as any)?.data || response;
            setJoinInfo(info as LiveJoinInformationRecord);

            // Prioriser HLS (meilleur pour live streaming)
            const streamUrl = info.hls_url || info.fallback_hls_url || info.webrtc_url;

            if (!streamUrl) {
                throw new Error('Aucune URL de streaming disponible');
            }

            setHlsUrl(streamUrl);
            setLoading(false);
            onLoad?.();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erreur chargement live stream';
            setError(errorMessage);
            setLoading(false);
            onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
    };

    useEffect(() => {
        if (hlsUrl && autoPlay && videoRef.current) {
            videoRef.current.playAsync().catch(err => {
                console.warn('[LiveStreamPlayer] Erreur lecture:', err);
            });
        }
    }, [hlsUrl, autoPlay]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>{t('liveStreamPlayer.chargementDuLive')}</Text>
            </View>
        );
    }

    if (error || !hlsUrl) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>
                    {error || 'Impossible de charger le live'}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Video
                ref={videoRef}
                source={{ uri: hlsUrl }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay={autoPlay}
                isLooping={false}
                useNativeControls={false}
                isMuted={false}
                onError={(error) => {
                    console.error('[LiveStreamPlayer] Erreur vidéo:', error);
                    setError(t('liveStreamPlayer.erreurDeLectureVideo'));
                    onError?.(new Error(t('liveStreamPlayer.erreurDeLectureVideo')));
                }}
                onLoad={() => {
                    setLoading(false);
                    onLoad?.();
                }}
            />
            {/* Badge LIVE */}
            <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
            </View>
            {/* Informations session */}
            {joinInfo && (
                <View style={styles.infoContainer}>
                    <Text style={styles.infoText} numberOfLines={1}>
                        {joinInfo.title}
                    </Text>
                </View>
            )}
            {/* ✅ NOUVEAU: Bouton chat live */}
            <TouchableOpacity
                style={styles.chatButton}
                onPress={() => setShowChat(true)}
                activeOpacity={0.85}
            >
                <SafeIcon name="message-circle" size={20} color="#FFF" />
                <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
            {/* ✅ NOUVEAU: Modal chat live */}
            <Modal
                visible={showChat}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowChat(false)}
            >
                <LiveChatModal
                    visible={showChat}
                    sessionId={sessionId}
                    userId={userId}
                    onClose={() => setShowChat(false)}
                />
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        color: '#F87171',
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    },
    liveBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFF',
    },
    liveText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    infoContainer: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 12,
        borderRadius: 8,
    },
    infoText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    chatButton: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
    },
    chatButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
});

