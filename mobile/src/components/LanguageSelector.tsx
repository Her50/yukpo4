import React, { useState, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  category: string;
}

export const LANGUAGES: Language[] = [
  // ── Langues mondiales ──
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', category: 'Langues mondiales' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', category: 'Langues mondiales' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', category: 'Langues mondiales' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', category: 'Langues mondiales' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', category: 'Langues mondiales' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', category: 'Langues mondiales' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', category: 'Langues mondiales' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', category: 'Langues mondiales' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', category: 'Langues mondiales' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', category: 'Langues mondiales' },

  // ── Langues africaines ──
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇹🇿', category: 'Langues africaines' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', flag: '🇳🇬', category: 'Langues africaines' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', flag: '🇳🇬', category: 'Langues africaines' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', flag: '🇳🇬', category: 'Langues africaines' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', category: 'Langues africaines' },
  { code: 'wo', name: 'Wolof', nativeName: 'Wolof', flag: '🇸🇳', category: 'Langues africaines' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦', category: 'Langues africaines' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '🇨🇩', category: 'Langues africaines' },
  { code: 'ff', name: 'Fula', nativeName: 'Fulfulde', flag: '🇬🇳', category: 'Langues africaines' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', flag: '🇷🇼', category: 'Langues africaines' },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona', flag: '🇿🇼', category: 'Langues africaines' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴', category: 'Langues africaines' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', flag: '🇪🇷', category: 'Langues africaines' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', flag: '🇲🇬', category: 'Langues africaines' },

  // ── Cameroun & Afrique Ouest ──
  { code: 'ewo', name: 'Ewondo', nativeName: 'Ewondo', flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'dua', name: 'Duala', nativeName: 'Duálá', flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'bbj', name: 'Ghomala', nativeName: "Ghɔmálá'", flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'bas', name: 'Basaa', nativeName: 'Basaa', flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'bum', name: 'Bulu', nativeName: 'Bulu', flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'bci', name: 'Baoule', nativeName: 'Baoulé', flag: '🇨🇮', category: 'Cameroun & Afrique Ouest' },
  { code: 'dyu', name: 'Jula', nativeName: 'Julakan', flag: '🇧🇫', category: 'Cameroun & Afrique Ouest' },
  { code: 'bet', name: 'Beti', nativeName: 'Beti', flag: '🇨🇲', category: 'Cameroun & Afrique Ouest' },
  { code: 'pcm', name: 'Pidgin English', nativeName: 'Naijá', flag: '🇳🇬', category: 'Cameroun & Afrique Ouest' },
  { code: 'mos', name: 'Moore', nativeName: 'Mòoré', flag: '🇧🇫', category: 'Cameroun & Afrique Ouest' },
  { code: 'bm', name: 'Bambara', nativeName: 'Bamanankan', flag: '🇲🇱', category: 'Cameroun & Afrique Ouest' },
  { code: 'dje', name: 'Zarma', nativeName: 'Zarmaciine', flag: '🇳🇪', category: 'Cameroun & Afrique Ouest' },
  { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe', flag: '🇹🇬', category: 'Cameroun & Afrique Ouest' },
  { code: 'kbp', name: 'Kabiye', nativeName: 'Kabɩyɛ', flag: '🇹🇬', category: 'Cameroun & Afrique Ouest' },
  { code: 'sar', name: 'Sara', nativeName: 'Sara', flag: '🇹🇩', category: 'Cameroun & Afrique Ouest' },
  { code: 'sg', name: 'Sango', nativeName: 'Sängö', flag: '🇨🇫', category: 'Cameroun & Afrique Ouest' },
  { code: 'kg', name: 'Kikongo', nativeName: 'Kikongo', flag: '🇨🇬', category: 'Cameroun & Afrique Ouest' },
  { code: 'lua', name: 'Tshiluba', nativeName: 'Tshiluba', flag: '🇨🇩', category: 'Cameroun & Afrique Ouest' },
  { code: 'fan', name: 'Fang', nativeName: 'Fang', flag: '🇬🇶', category: 'Cameroun & Afrique Ouest' },

  // ── Autres régions ──
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', flag: '🇿🇦', category: 'Autres régions' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', category: 'Autres régions' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', flag: '🇱🇸', category: 'Autres régions' },
  { code: 'rn', name: 'Kirundi', nativeName: 'Ikirundi', flag: '🇧🇮', category: 'Autres régions' },
  { code: 'srr', name: 'Serer', nativeName: 'Seereer', flag: '🇸🇳', category: 'Autres régions' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl', flag: '🇭🇹', category: 'Autres régions' },
  { code: 'pap', name: 'Papiamento', nativeName: 'Papiamentu', flag: '🇨🇼', category: 'Autres régions' },

  // ── Asie & Europe ──
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', category: 'Asie & Europe' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', category: 'Asie & Europe' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', category: 'Asie & Europe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', category: 'Asie & Europe' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย', flag: '🇹🇭', category: 'Asie & Europe' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', category: 'Asie & Europe' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', category: 'Asie & Europe' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', category: 'Asie & Europe' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', category: 'Asie & Europe' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', category: 'Asie & Europe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', category: 'Asie & Europe' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', category: 'Asie & Europe' },
];

const CATEGORY_ORDER = [
  'Langues mondiales',
  'Langues africaines',
  'Cameroun & Afrique Ouest',
  'Autres régions',
  'Asie & Europe',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Langues mondiales': 'globe',
  'Langues africaines': 'sun',
  'Cameroun & Afrique Ouest': 'map-pin',
  'Autres régions': 'compass',
  'Asie & Europe': 'navigation',
};

function buildSections(languages: Language[]) {
  const grouped: Record<string, Language[]> = {};
  for (const lang of languages) {
    if (!grouped[lang.category]) grouped[lang.category] = [];
    grouped[lang.category].push(lang);
  }
  return CATEGORY_ORDER
    .filter(cat => grouped[cat]?.length)
    .map(cat => ({ title: cat, data: grouped[cat] }));
}

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
  const [search, setSearch] = useState('');

  const currentLanguage = LANGUAGES.find(l => l.code === selectedLanguage) || LANGUAGES[0];

  const filteredSections = useMemo(() => {
    if (!search.trim()) return buildSections(LANGUAGES);
    const q = search.trim().toLowerCase();
    const filtered = LANGUAGES.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
    return buildSections(filtered);
  }, [search]);

  const handleSelectLanguage = (code: string) => {
    onLanguageChange(code);
    setModalVisible(false);
    setSearch('');
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSearch('');
  };

  const renderItem = ({ item }: { item: Language }) => {
    const isSelected = item.code === selectedLanguage;
    return (
      <TouchableOpacity
        style={[styles.languageItem, isSelected && styles.languageItemSelected]}
        onPress={() => handleSelectLanguage(item.code)}
        activeOpacity={0.7}
      >
        <View style={styles.languageInfo}>
          <Text style={styles.languageFlag}>{item.flag}</Text>
          <View style={styles.languageTextContainer}>
            <Text style={styles.languageName}>{item.nativeName}</Text>
            <Text style={styles.languageSubtext}>
              {item.name} — {item.code}
            </Text>
          </View>
        </View>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <SafeIcon name="check-circle" size={22} color={modernColors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <SafeIcon
        name={CATEGORY_ICONS[section.title] || 'tag'}
        size={16}
        color={modernColors.primary}
      />
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const languageModal = (
    <Modal
      animationType="slide"
      transparent
      visible={modalVisible}
      onRequestClose={handleCloseModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <SafeIcon name="globe" size={24} color={modernColors.primary} />
              <Text style={styles.modalTitle}>
                {t('languageSelector.choisirLaLangue')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
              <SafeIcon name="x" size={24} color={modernColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('languageSelector.rechercherLangue') || 'Rechercher une langue...'}
              placeholderTextColor={modernColors.textSecondary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <SafeIcon name="x-circle" size={18} color={modernColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <SectionList
            sections={filteredSections}
            keyExtractor={item => item.code}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <SafeIcon name="search" size={40} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>
                  {t('languageSelector.aucunResultat') || 'Aucune langue trouvée'}
                </Text>
              </View>
            }
          />

          <View style={styles.modalFooter}>
            <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
            <Text style={styles.footerText}>
              {LANGUAGES.length} {t('languageSelector.languesDisponibles') || 'langues disponibles'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (compact) {
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
        {languageModal}
      </>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <Text style={styles.fullSectionTitle}>
        {t('languageSelector.langueDeLapplication')}
      </Text>
      <TouchableOpacity
        style={styles.fullCurrentLanguage}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.languageInfo}>
          <Text style={styles.languageFlag}>{currentLanguage.flag}</Text>
          <View style={styles.languageTextContainer}>
            <Text style={styles.languageName}>{currentLanguage.nativeName}</Text>
            <Text style={styles.languageSubtext}>
              {currentLanguage.name} — {currentLanguage.code}
            </Text>
          </View>
        </View>
        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
      </TouchableOpacity>
      {languageModal}
    </View>
  );
};

const styles = StyleSheet.create({
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    height: '100%',
    minHeight: 32,
  },
  flagEmoji: {
    fontSize: 18,
    lineHeight: 18,
    textAlignVertical: 'center',
  },
  languageCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    lineHeight: 11,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
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

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.background,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: modernColors.text,
    paddingVertical: 0,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: modernColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
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
    gap: 14,
  },
  languageFlag: {
    fontSize: 28,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 2,
  },
  languageSubtext: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  checkmarkContainer: {
    marginLeft: 10,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: modernColors.textSecondary,
  },

  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: modernColors.textSecondary,
    lineHeight: 16,
  },

  fullContainer: {
    padding: 20,
  },
  fullSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 16,
  },
  fullCurrentLanguage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: modernColors.background,
    borderWidth: 1,
    borderColor: modernColors.border,
  },
});

export default LanguageSelector;
