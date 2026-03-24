// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeIcon from './SafeIcon';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeStorage from '../utils/safeStorage';

interface IntelligentChatFabProps {
  onPress?: () => void;
  visible?: boolean;
  screenName?: string;
  hideOnScreens?: string[];
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 60;
const FAB_SIZE = 48;
const FAB_BOTTOM_OFFSET = TAB_BAR_HEIGHT + 12;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FAB_POSITION_STORAGE_KEY = 'yukpo_ia_fab_position_v1';

const SCREENS_WITH_BOTTOM_ACTION = [
  'ServiceDetail', 'PharmacieDetails', 'HopitalDetails', 'LaboratoireDetails',
  'BanqueSangDetails', 'CovoiturageDetails', 'ImmobilierDetails', 'OffreDetails',
  'EtablissementDetails', 'TaxiBooking', 'HotelBooking', 'BusTicketBooking',
];

const IntelligentChatFab: React.FC<IntelligentChatFabProps> = ({
  onPress,
  visible = true,
  screenName,
  hideOnScreens = ['ChatModalMobile'],
}) => {
  const { t } = useLanguageSafe();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - FAB_SIZE - 14, y: SCREEN_HEIGHT - FAB_SIZE - FAB_BOTTOM_OFFSET })).current;
  const [isVisible, setIsVisible] = useState(visible);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  const positionLoadedRef = useRef(false);

  const needsHigherPosition = screenName && SCREENS_WITH_BOTTOM_ACTION.includes(screenName);
  const bottomOffset = needsHigherPosition ? FAB_BOTTOM_OFFSET + 56 : FAB_BOTTOM_OFFSET;
  const tooltipLabel = (t('intelligentChat.tooltipHelp') || 'Besoin d\'aide ?')
    .replace(/\s+/g, ' ')
    .trim();

  useEffect(() => {
    const shouldHide = screenName && hideOnScreens.includes(screenName);
    const show = visible && !shouldHide;
    setIsVisible(show);
    Animated.timing(fadeAnim, {
      toValue: show ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (show) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current = pulse;
      pulse.start();

      tooltipTimerRef.current = setTimeout(() => {
        setShowTooltip(true);
        Animated.timing(tooltipAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        setTimeout(() => {
          Animated.timing(tooltipAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowTooltip(false));
        }, 4000);
      }, 2000);
    }

    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (pulseRef.current) pulseRef.current.stop();
    };
  }, [screenName, visible, hideOnScreens]);

  const clampX = useCallback((x: number) => Math.max(8, Math.min(x, SCREEN_WIDTH - FAB_SIZE - 8)), []);
  const clampY = useCallback((y: number) => Math.max(8, Math.min(y, SCREEN_HEIGHT - FAB_SIZE - 8)), []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    pan.setValue({
      x: clampX(SCREEN_WIDTH - FAB_SIZE - 14),
      y: clampY(SCREEN_HEIGHT - FAB_SIZE - bottomOffset),
    });
  }, [bottomOffset, clampX, clampY, pan]);

  useEffect(() => {
    if (positionLoadedRef.current) return;
    positionLoadedRef.current = true;

    (async () => {
      try {
        const raw = await SafeStorage.getItem(FAB_POSITION_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return;
        pan.setValue({ x: clampX(parsed.x), y: clampY(parsed.y) });
      } catch {
        // Position invalide en storage: ignorer silencieusement.
      }
    })();
  }, [clampX, clampY, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        setIsDragging(false);
        dragStartRef.current = { x: (pan.x as any)._value || 0, y: (pan.y as any)._value || 0 };
      },
      onPanResponderMove: (_, gestureState) => {
        setIsDragging(true);
        const nextX = clampX(dragStartRef.current.x + gestureState.dx);
        const nextY = clampY(dragStartRef.current.y + gestureState.dy);
        pan.setValue({ x: nextX, y: nextY });
      },
      onPanResponderRelease: (_, gestureState) => {
        const moved = Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
        if (moved) {
          const pos = { x: (pan.x as any)._value || 0, y: (pan.y as any)._value || 0 };
          void SafeStorage.setItem(FAB_POSITION_STORAGE_KEY, JSON.stringify(pos));
        }
        if (!moved) {
          handlePress();
        }
        setTimeout(() => setIsDragging(false), 0);
      },
      onPanResponderTerminate: () => {
        setTimeout(() => setIsDragging(false), 0);
      },
      onShouldBlockNativeResponder: () => false,
    }),
  ).current;

  const handlePressIn = useCallback(() => {
    if (pulseRef.current) pulseRef.current.stop();
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (showTooltip) {
      setShowTooltip(false);
    }
    onPress?.();
  }, [onPress, showTooltip]);

  const handleResetPosition = useCallback(() => {
    const resetPos = {
      x: clampX(SCREEN_WIDTH - FAB_SIZE - 14),
      y: clampY(SCREEN_HEIGHT - FAB_SIZE - bottomOffset),
    };
    pan.setValue(resetPos);
    void SafeStorage.removeItem(FAB_POSITION_STORAGE_KEY);
  }, [bottomOffset, clampX, clampY, pan]);

  if (!isVisible) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          left: pan.x,
          top: pan.y,
        },
      ]}
    >
      {showTooltip && (
        <Animated.View style={[styles.tooltip, { opacity: tooltipAnim, transform: [{ translateX: -8 }] }]}>
          <Text style={styles.tooltipText} numberOfLines={1} ellipsizeMode="clip">{tooltipLabel}</Text>
          <View style={styles.tooltipArrow} />
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => { if (!isDragging) handlePress(); }}
          onLongPress={handleResetPosition}
          delayLongPress={650}
          style={styles.fab}
          accessibilityLabel={t('intelligentChat.title') || 'Assistant IA Yukpo'}
          accessibilityRole="button"
          accessibilityHint={t('intelligentChat.tooltipHelp') || 'Ouvrir l\'assistant intelligent'}
        >
          <View style={styles.fabGlow} />
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <SafeIcon name="sparkles" size={20} color="#FFFFFF" />
          </Animated.View>
          <View style={styles.aiMiniBadge}>
            <SafeIcon name="bot" size={11} color="#6366f1" type="lucide" />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.statusDot} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
    elevation: 10,
    alignItems: 'flex-end',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  fabGlow: {
    position: 'absolute',
    width: FAB_SIZE + 12,
    height: FAB_SIZE + 12,
    borderRadius: (FAB_SIZE + 12) / 2,
    backgroundColor: '#6366f1',
    opacity: 0.18,
  },
  aiMiniBadge: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  tooltip: {
    position: 'absolute',
    right: FAB_SIZE + 8,
    top: (FAB_SIZE - 32) / 2,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
    minWidth: 110,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
    flexShrink: 0,
    textAlign: 'center',
  },
  tooltipArrow: {
    position: 'absolute',
    right: -6,
    top: '50%',
    marginTop: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: '#1e293b',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

export default IntelligentChatFab;
