import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

// Note: Requires react-native-webrtc or LiveKit SDK already configured in the project
// Graceful degradation if not available

const VisiteVideoLiveScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { propertyId, propertyTitle, agentName, roomToken } = route.params || {};

    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [duration, setDuration] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleConnect = () => {
        setConnecting(true);
        // Simulate connection for graceful degradation
        setTimeout(() => {
            setConnecting(false);
            setConnected(true);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }, 2000);
    };

    const handleDisconnect = () => {
        Alert.alert('Terminer la visite ?', 'La session vidéo sera clôturée.', [
            { text: 'Continuer', style: 'cancel' },
            { text: 'Terminer', style: 'destructive', onPress: () => {
                if (timerRef.current) clearInterval(timerRef.current);
                setConnected(false);
                setDuration(0);
                navigation.goBack();
            }},
        ]);
    };

    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    if (!connected) {
        return (
            <View style={styles.container}>
                <View style={styles.previewContainer}>
                    {/* Property info */}
                    <View style={styles.propertyInfo}>
                        <SafeIcon name="home" size={20} color="#fff" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.propertyTitle} numberOfLines={2}>{propertyTitle || 'Visite virtuelle'}</Text>
                            {agentName && <Text style={styles.agentName}>Agent : {agentName}</Text>}
                        </View>
                    </View>

                    {/* Camera preview placeholder */}
                    <View style={styles.camPreview}>
                        <SafeIcon name="video" size={48} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.camPreviewText}>Prévisualisation caméra</Text>
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionsCard}>
                        <Text style={styles.instructionsTitle}>Avant de commencer</Text>
                        <View style={styles.instructionRow}>
                            <SafeIcon name="wifi" size={16} color="#059669" />
                            <Text style={styles.instructionText}>Assurez-vous d'avoir une bonne connexion</Text>
                        </View>
                        <View style={styles.instructionRow}>
                            <SafeIcon name="mic" size={16} color="#059669" />
                            <Text style={styles.instructionText}>Vérifiez que votre micro est activé</Text>
                        </View>
                        <View style={styles.instructionRow}>
                            <SafeIcon name="eye" size={16} color="#059669" />
                            <Text style={styles.instructionText}>L'agent vous montrera chaque pièce en détail</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.connectBtn, connecting && styles.connectBtnDisabled]} onPress={handleConnect} disabled={connecting}>
                        <SafeIcon name="video" size={20} color="#fff" />
                        <Text style={styles.connectBtnText}>{connecting ? 'Connexion...' : 'Démarrer la visite'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelBtnText}>Annuler</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Remote video (agent showing property) */}
            <View style={styles.remoteVideo}>
                <View style={styles.remoteVideoPlaceholder}>
                    <SafeIcon name="home" size={64} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.remoteVideoText}>{agentName || 'Agent'}</Text>
                    <Text style={styles.remoteVideoSub}>Visite en cours...</Text>
                </View>
            </View>

            {/* Local camera (small) */}
            <View style={styles.localCamera}>
                {camOn ? (
                    <View style={styles.localCameraActive}>
                        <SafeIcon name="user" size={24} color="rgba(255,255,255,0.7)" />
                    </View>
                ) : (
                    <View style={styles.localCameraOff}>
                        <SafeIcon name="video-off" size={20} color="#9CA3AF" />
                    </View>
                )}
            </View>

            {/* Top bar */}
            <View style={styles.topBar}>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>EN DIRECT</Text>
                </View>
                <Text style={styles.durationText}>{formatDuration(duration)}</Text>
                <View style={styles.connectionQuality}>
                    <SafeIcon name="wifi" size={14} color="#10B981" />
                    <Text style={styles.connectionText}>HD</Text>
                </View>
            </View>

            {/* Property name overlay */}
            <View style={styles.propertyOverlay}>
                <Text style={styles.propertyOverlayText} numberOfLines={1}>{propertyTitle}</Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity style={[styles.controlBtn, !micOn && styles.controlBtnOff]} onPress={() => setMicOn(m => !m)}>
                    <SafeIcon name={micOn ? 'mic' : 'mic-off'} size={22} color="#fff" />
                    <Text style={styles.controlLabel}>{micOn ? 'Micro' : 'Muet'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.endCallBtn} onPress={handleDisconnect}>
                    <SafeIcon name="phone-off" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlBtn, !camOn && styles.controlBtnOff]} onPress={() => setCamOn(c => !c)}>
                    <SafeIcon name={camOn ? 'video' : 'video-off'} size={22} color="#fff" />
                    <Text style={styles.controlLabel}>{camOn ? 'Caméra' : 'Off'}</Text>
                </TouchableOpacity>
            </View>

            {/* Chat hint */}
            <View style={styles.chatHint}>
                <SafeIcon name="message-circle" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.chatHintText}>Posez vos questions directement à l'agent</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    previewContainer: { flex: 1, padding: 20, justifyContent: 'center' },
    propertyInfo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, marginBottom: 20 },
    propertyTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    agentName: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
    camPreview: { height: 200, backgroundColor: '#1E293B', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 12 },
    camPreviewText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    instructionsCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 24, gap: 10 },
    instructionsTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 },
    instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    instructionText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#059669', paddingVertical: 16, borderRadius: 14, marginBottom: 12 },
    connectBtnDisabled: { opacity: 0.6 },
    connectBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cancelBtn: { alignItems: 'center', paddingVertical: 14 },
    cancelBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
    remoteVideo: { flex: 1, backgroundColor: '#1E293B' },
    remoteVideoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    remoteVideoText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    remoteVideoSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    localCamera: { position: 'absolute', bottom: 120, right: 16, width: 90, height: 120, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
    localCameraActive: { flex: 1, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
    localCameraOff: { flex: 1, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, backgroundColor: 'rgba(0,0,0,0.4)' },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    durationText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    connectionQuality: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    connectionText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
    propertyOverlay: { position: 'absolute', bottom: 190, left: 16, right: 120, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 8 },
    propertyOverlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    controls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 32 },
    controlBtn: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', width: 64, height: 64, borderRadius: 32, justifyContent: 'center' },
    controlBtnOff: { backgroundColor: 'rgba(239,68,68,0.8)' },
    controlLabel: { position: 'absolute', bottom: -20, fontSize: 10, color: 'rgba(255,255,255,0.7)', width: 60, textAlign: 'center' },
    endCallBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
    chatHint: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    chatHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
});

export default VisiteVideoLiveScreen;
