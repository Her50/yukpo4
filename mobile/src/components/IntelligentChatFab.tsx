// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeIcon from './SafeIcon';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface IntelligentChatFabProps {
  onPress?: () => void;
  visible?: boolean;
  screenName?: string;
  hideOnScreens?: string[];
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 60;
const FAB_SIZE = 48;
const FAB_BOTTOM_OFFSET = TAB_BAR_HEIGHT + 12;

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
  const [isVisible, setIsVisible] = useState(visible);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const needsHigherPosition = screenName && SCREENS_WITH_BOTTOM_ACTION.includes(screenName);
  const bottomOffset = needsHigherPosition ? FAB_BOTTOM_OFFSET + 56 : FAB_BOTTOM_OFFSET;

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
            toValue: 1.08,
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

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, { bottom: bottomOffset, opacity: fadeAnim }]}>
      {showTooltip && (
        <Animated.View style={[styles.tooltip, { opacity: tooltipAnim, transform: [{ translateX: -8 }] }]}>
          <Text style={styles.tooltipText}>{t('intelligentChat.tooltipHelp') || 'Besoin d\'aide ?'}</Text>
          <View style={styles.tooltipArrow} />
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.fab}
          accessibilityLabel={t('intelligentChat.title') || 'Assistant IA Yukpo'}
          accessibilityRole="button"
          accessibilityHint={t('intelligentChat.tooltipHelp') || 'Ouvrir l\'assistant intelligent'}
        >
          <Animated.View style={[styles.fabInner, { transform: [{ scale: scaleAnim }] }]}>
            <SafeIcon name="bot" size={22} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.statusDot} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 14,
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
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
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
    maxWidth: 160,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
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
