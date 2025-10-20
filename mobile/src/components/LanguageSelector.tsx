// 🌍 Sélecteur de Langue - 7 langues les plus parlées au monde
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from './SafeIcon';
import { modernColors } from '../theme/modernTheme';

// 7 langues les plus parlées au monde
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speakers: '1.5B' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', speakers: '1.1B' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speakers: '600M' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speakers: '560M' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speakers: '280M' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', speakers: '274M' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', speakers: '258M' },
];

interface LanguageSelectorProps {
  selectedLanguage?: string;
  onLanguageChange: (languageCode: string) => void;
  compact?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage = 'fr',
  onLanguageChange,
  compact = true,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const currentLanguage = LANGUAGES.find(lang => lang.code === selectedLanguage) || LANGUAGES[4]; // Français par défaut

  const handleSelectLanguage = (code: string) => {
    onLanguageChange(code);
    setModalVisible(false);
  };

  if (compact) {
    // Version compacte pour le header
    return (
      <>
        <TouchableOpacity
          style={styles.compactButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.flagEmoji}>{currentLanguage.flag}</Text>
          <Text style={styles.languageCode}>{currentLanguage.code.toUpperCase()}</Text>
          <SafeIcon name="chevron-down" size={12} color="#fff" />
        </TouchableOpacity>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <SafeIcon name="globe" size={24} color={modernColors.primary} />
                  <Text style={styles.modalTitle}>Choisir la langue</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Liste des langues */}
              <ScrollView style={styles.languagesList} showsVerticalScrollIndicator={false}>
                {LANGUAGES.map((language) => {
                  const isSelected = language.code === selectedLanguage;
                  return (
                    <TouchableOpacity
                      key={language.code}
                      style={[
                        styles.languageItem,
                        isSelected && styles.languageItemSelected,
                      ]}
                      onPress={() => handleSelectLanguage(language.code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.languageInfo}>
                        <Text style={styles.languageFlag}>{language.flag}</Text>
                        <View style={styles.languageTextContainer}>
                          <Text style={styles.languageName}>{language.nativeName}</Text>
                          <Text style={styles.languageSubtext}>
                            {language.name} • {language.speakers} locuteurs
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.checkmarkContainer}>
                          <SafeIcon name="check-circle" size={24} color={modernColors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Footer info */}
              <View style={styles.modalFooter}>
                <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                <Text style={styles.footerText}>
                  La traduction sera disponible prochainement pour toutes les langues
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Version complète (pour les settings)
  return (
    <View style={styles.fullContainer}>
      <Text style={styles.sectionTitle}>Langue de l'application</Text>
      {LANGUAGES.map((language) => {
        const isSelected = language.code === selectedLanguage;
        return (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageItem,
              isSelected && styles.languageItemSelected,
            ]}
            onPress={() => onLanguageChange(language.code)}
            activeOpacity={0.7}
          >
            <View style={styles.languageInfo}>
              <Text style={styles.languageFlag}>{language.flag}</Text>
              <View style={styles.languageTextContainer}>
                <Text style={styles.languageName}>{language.nativeName}</Text>
                <Text style={styles.languageSubtext}>
                  {language.name} • {language.speakers} locuteurs
                </Text>
              </View>
            </View>
            {isSelected && (
              <View style={styles.checkmarkContainer}>
                <SafeIcon name="check-circle" size={24} color={modernColors.primary} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // Version compacte (header)
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  flagEmoji: {
    fontSize: 18,
  },
  languageCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
  },
  closeButton: {
    padding: 4,
  },

  // Liste des langues
  languagesList: {
    padding: 20,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: modernColors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageItemSelected: {
    backgroundColor: modernColors.primary + '10',
    borderColor: modernColors.primary,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  languageFlag: {
    fontSize: 32,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  languageSubtext: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  checkmarkContainer: {
    marginLeft: 12,
  },

  // Footer
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: modernColors.textSecondary,
    lineHeight: 16,
  },

  // Version complète
  fullContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 16,
  },
});

export default LanguageSelector;
