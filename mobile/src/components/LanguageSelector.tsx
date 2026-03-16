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
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

// 7 langues les plus parlées au monde
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speakers: '1.5B' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', speakers: '1.1B' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speakers: '600M' },
  { code: 'es', name: 'Spanish', nativeName: t('languageSelector.espanol'), flag: '🇪🇸', speakers: '560M' },
  { code: 'fr', name: 'French', nativeName: t('languageSelector.francais'), flag: '🇫🇷', speakers: '280M' },
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
      const { t } = useLanguageSafe();
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
                  <Text style={styles.modalTitle}>{t('languageSelector.choisirLaLangue')}</Text>
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
      <Text style={styles.sectionTitle}>{t('languageSelector.langueDeLapplication')}</Text>
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
    alignItems: 'center', // ✅ CORRIGÉ: Centrer verticalement
    justifyContent: 'center', // ✅ CORRIGÉ: Centrer horizontalement
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8, // ✅ Réduit de 12 à 8 pour libérer de l'espace
    paddingVertical: 4, // ✅ CORRIGÉ: Réduit de 6 à 4 pour meilleur alignement
    borderRadius: 20,
    gap: 4, // ✅ Réduit de 6 à 4 pour libérer de l'espace
    height: '100%', // ✅ CORRIGÉ: Prendre 100% de la hauteur pour alignement avec "Yukpo"
    minHeight: 32, // ✅ CORRIGÉ: Hauteur minimale pour touch target
  },
  flagEmoji: {
    fontSize: 18,
    lineHeight: 18, // ✅ CORRIGÉ: Définir lineHeight égal à fontSize pour alignement
    textAlignVertical: 'center', // ✅ CORRIGÉ: Centrer verticalement
  },
  languageCode: {
    fontSize: 11, // ✅ Réduit de 12 à 11 pour libérer de l'espace
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3, // ✅ Réduit de 0.5 à 0.3 pour libérer de l'espace
    lineHeight: 11, // ✅ CORRIGÉ: Définir lineHeight égal à fontSize pour alignement
    textAlignVertical: 'center', // ✅ CORRIGÉ: Centrer verticalement
    includeFontPadding: false, // ✅ CORRIGÉ: Désactiver le padding de police
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
