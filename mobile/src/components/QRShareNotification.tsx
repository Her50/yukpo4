// @ts-nocheck
// ✅ Composant de notification améliorée pour le partage QR

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import { SafeIcon } from './SafeIcon';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface QRShareNotificationProps {
  visible: boolean;
  type: 'whatsapp' | 'sms' | 'qr_generated' | 'share_native' | 'error';
  message: string;
  recipientName?: string;
  onHide?: () => void;
  duration?: number;
}

const { width } = Dimensions.get('window');

const QRShareNotification: React.FC<QRShareNotificationProps> = ({
  visible,
  type,
  message,
  recipientName,
  onHide,
  duration = 3000,
}) => {
  const { t } = useLanguageSafe();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (visible) {
      // Animation d'entrée
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Vibration selon le type
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        switch (type) {
          case 'whatsapp':
            Vibration.vibrate([100, 50, 100]);
            break;
          case 'sms':
            Vibration.vibrate([100, 100]);
            break;
          case 'qr_generated':
            Vibration.vibrate([150, 50, 150]);
            break;
          case 'share_native':
            Vibration.vibrate(100);
            break;
          case 'error':
            Vibration.vibrate(500);
            break;
        }
      }

      // Auto-hide après duration
      const timer = setTimeout(() => {
        hideNotification();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, type, duration]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!visible) return null;

  const getNotificationConfig = () => {
    switch (type) {
      case 'whatsapp':
        return {
          icon: 'MessageCircle',
          color: '#25D366',
          bgColor: '#E8F5E8',
          title: t('qrShareNotification.whatsapp'),
          subtitle: recipientName ? t('qrShareNotification.whatsappSentTo', { name: recipientName }) : t('qrShareNotification.whatsappSent'),
        };
      case 'sms':
        return {
          icon: 'MessageSquare',
          color: '#007AFF',
          bgColor: '#E8F4FF',
          title: t('qrShareNotification.sms'),
          subtitle: recipientName ? t('qrShareNotification.smsSentTo', { name: recipientName }) : t('qrShareNotification.smsSent'),
        };
      case 'qr_generated':
        return {
          icon: 'QrCode',
          color: '#7C3AED',
          bgColor: '#F3E8FF',
          title: t('qrShareNotification.qrGenerated'),
          subtitle: t('qrShareNotification.qrGeneratedSuccess'),
        };
      case 'share_native':
        return {
          icon: 'Share2',
          color: '#10B981',
          bgColor: '#E8F5E8',
          title: t('qrShareNotification.shareNative'),
          subtitle: t('qrShareNotification.linkShared'),
        };
      case 'error':
        return {
          icon: 'AlertCircle',
          color: '#EF4444',
          bgColor: '#FEE2E2',
          title: t('qrShareNotification.error'),
          subtitle: t('qrShareNotification.shareFailed'),
        };
      default:
        return {
          icon: 'CheckCircle',
          color: '#10B981',
          bgColor: '#E8F5E8',
          title: t('qrShareNotification.success'),
          subtitle: t('qrShareNotification.operationSuccess'),
        };
    }
  };

  const config = getNotificationConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: config.bgColor,
          borderColor: config.color,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
        <SafeIcon 
          name={config.icon} 
          size={20} 
          color="#FFFFFF" 
        />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: config.color }]}>
          {config.title}
        </Text>
        <Text style={styles.subtitle}>
          {config.subtitle}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>
      
      <SafeIcon 
        name="X" 
        size={16} 
        color={config.color}
        onPress={hideNotification}
        style={styles.closeButton}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
});

export default QRShareNotification;
