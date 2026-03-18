import React, { useCallback } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeIcon from './SafeIcon';

const WHATSAPP_NUMBER = '237695000000';

const FloatingHelpButton: React.FC = () => {
  const { t } = useLanguageSafe();

  const handlePress = useCallback(async () => {
    const message = encodeURIComponent(
      t('floatingHelpButton.whatsappMessage') || 'Bonjour, j\'ai besoin d\'aide avec l\'application Yukpo.'
    );
    const url = Platform.select({
      ios: `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`,
      android: `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`,
      default: `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`,
    });

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`);
      }
    } catch {
      await Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`);
    }
  }, [t]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityLabel={t('floatingHelpButton.besoinDaide') || 'Besoin d\'aide ?'}
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        <SafeIcon name="message-circle" size={18} color="#FFFFFF" />
        <Text style={styles.text}>
          {t('floatingHelpButton.besoinDaide') || 'Besoin d\'aide ?'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#25D366',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 50,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default FloatingHelpButton;
