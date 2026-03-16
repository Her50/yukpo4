import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeIcon from '../components/SafeIcon';
import { LiveChatModal } from '../components/video/LiveChatModal';
import { useAuth } from '../contexts/AuthContext';
import { liveKitService } from '../services/liveKitService';
import { liveStreamingService } from '../services/liveStreamingService';
import { useLanguageSafe } from '../contexts/LanguageContext';

type RouteParams = {
  sessionId: string;
  streamKey?: string;
  rtmpUrl?: string;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LiveHostScreen() {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const route = useRoute();
  const { user } = useAuth();
  const { sessionId, streamKey, rtmpUrl } = (route.params as any) || {};
  const viewerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  // Update duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLive) {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Handle back button
  useEffect(() => {
    const handleBackPress = () => {
      if (isLive) {
        Alert.alert(
          'Live en cours',
          t('liveHostScreen.etesvousSurDeVouloirTerminerVotre'),
          [
            { text: t('common.no'), style: 'cancel' },
            { text: t('common.finish'), style: 'destructive', onPress: () => endLive() },
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [isLive]);

  const startLive = async () => {
    try {
      // Connect to LiveKit as host (isHost=true for publish permission)
      if (sessionId) {
        const hostUserId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 0;
        await liveKitService.joinRoom(sessionId, hostUserId, undefined, undefined, undefined, true);
        setIsConnected(true);
        setIsLive(true);
        startTimeRef.current = Date.now();

        // Poll real viewer count from backend
        viewerIntervalRef.current = setInterval(async () => {
          try {
            const resp = await liveStreamingService.getLiveSession(sessionId);
            const backendResp = (resp as any).data || resp;
            const innerData = backendResp?.data || backendResp;
            const sessionObj = innerData?.session || innerData;
            if (sessionObj) {
              setViewerCount(sessionObj.current_viewers || 0);
            }
          } catch (_e) { /* silently ignore polling errors */ }
        }, 5000);
      }
    } catch (error) {
      console.error('[LiveHostScreen] Erreur connexion LiveKit:', error);
      Alert.alert('Erreur', 'Impossible de démarrer le live');
    }
  };

  const endLive = async () => {
    try {
      setIsLive(false);
      if (viewerIntervalRef.current) {
        clearInterval(viewerIntervalRef.current);
        viewerIntervalRef.current = null;
      }
      await liveKitService.leaveRoom();
      setIsConnected(false);
      navigation.goBack();
    } catch (error) {
      console.error('[LiveHostScreen] Erreur fin du live:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderStreamingInfo = () => (
    <View style={styles.streamingInfo}>
      <View style={styles.liveIndicator}>
        <SafeIcon name="radio" size={12} color="#FFFFFF" />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
      <View style={styles.viewerCount}>
        <SafeIcon name="users" size={14} color="#FFFFFF" />
        <Text style={styles.viewerText}>{viewerCount}</Text>
      </View>
      <View style={styles.duration}>
        <SafeIcon name="clock" size={14} color="#FFFFFF" />
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controls}>
      <TouchableOpacity
        style={[styles.controlButton, styles.chatButton]}
        onPress={() => setShowChat(true)}
      >
        <SafeIcon name="message-circle" size={20} color="#FFFFFF" />
        <Text style={styles.controlButtonText}>Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, styles.flashSaleButton]}
        onPress={() => {
          (navigation as any).navigate('FlashSale', { sessionId });
        }}
      >
        <SafeIcon name="zap" size={20} color="#FFFFFF" />
        <Text style={styles.controlButtonText}>{t('liveHost.venteFlash')}/Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.controlButton, styles.endButton]}
        onPress={() => {
          Alert.alert(
            'Terminer le Live',
            t('liveHostScreen.etesvousSurDeVouloirTerminerVotre'),
            [
              { text: t('common.no'), style: 'cancel' },
              { text: t('common.finish'), style: 'destructive', onPress: endLive },
            ]
          );
        }}
      >
        <SafeIcon name="square" size={20} color="#FFFFFF" />
        <Text style={styles.controlButtonText}>Terminer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.previewPlaceholder}>
        <SafeIcon name="video-off" size={48} color="#9CA3AF" />
        <Text style={styles.previewText}>{t('liveHost.preparationDuLive')}</Text>
        {streamKey && rtmpUrl && (
          <View style={styles.streamInfo}>
            <Text style={styles.streamInfoText}>{t('liveHostScreen.cleDeStream')} {streamKey}</Text>
            <Text style={styles.streamInfoText}>URL RTMP: {rtmpUrl}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.startButton, !isConnected && styles.startButtonDisabled]}
        onPress={startLive}
        disabled={isConnected}
      >
        <SafeIcon name="play" size={24} color="#FFFFFF" />
        <Text style={styles.startButtonText}>
          {isConnected ? 'Connexion en cours...' : 'Commencer le Live'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isLive) {
              Alert.alert(
                'Live en cours',
                t('liveHostScreen.etesvousSurDeVouloirTerminerVotre'),
                [
                  { text: t('common.no'), style: 'cancel' },
                  { text: t('common.finish'), style: 'destructive', onPress: endLive },
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <SafeIcon name="x" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {isLive && renderStreamingInfo()}

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.moreButton}>
            <SafeIcon name="more-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {!isLive ? (
          renderPreview()
        ) : (
          <View style={styles.liveContainer}>
            {/* Camera preview would go here */}
            <View style={styles.cameraPlaceholder}>
              <SafeIcon name="video" size={64} color="#FFFFFF" />
              <Text style={styles.livePlaceholderText}>Live en cours...</Text>
            </View>

            {/* Floating controls overlay */}
            <View style={styles.overlayControls}>
              {renderControls()}
            </View>
          </View>
        )}
      </View>

      {/* Chat Modal */}
      <LiveChatModal
        visible={showChat}
        sessionId={sessionId}
        userId={user?.id ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : 0}
        onClose={() => setShowChat(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewPlaceholder: {
    alignItems: 'center',
    gap: 16,
  },
  previewText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
  },
  streamInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    gap: 4,
  },
  streamInfoText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginTop: 32,
  },
  startButtonDisabled: {
    backgroundColor: '#4B5563',
    opacity: 0.6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  liveContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  livePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  overlayControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  chatButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  flashSaleButton: {
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
  },
  endButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
