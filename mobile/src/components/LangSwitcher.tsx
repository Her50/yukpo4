import { Picker } from '@react-native-picker/picker';
import * as React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

const LANGUAGES = [
  // Langues mondiales
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "ja", label: "日本語" },
  { code: "ru", label: "Русский" },
  // Langues africaines
  { code: "sw", label: "Kiswahili" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "am", label: "አማርኛ" },
  { code: "wo", label: "Wolof" },
  { code: "zu", label: "isiZulu" },
  { code: "ln", label: "Lingála" },
  { code: "ff", label: "Fulfulde" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "sn", label: "chiShona" },
  { code: "so", label: "Soomaali" },
  { code: "ti", label: "ትግርኛ" },
  { code: "mg", label: "Malagasy" },
  // Cameroun & Afrique Ouest
  { code: "ewo", label: "Ewondo" },
  { code: "dua", label: "Duálá" },
  { code: "bbj", label: "Ghomálá'" },
  { code: "bas", label: "Basaa" },
  { code: "bum", label: "Bulu" },
  { code: "bci", label: "Baoulé" },
  { code: "dyu", label: "Dioula" },
  { code: "bet", label: "Bété" },
  { code: "pcm", label: "Pidgin" },
  { code: "mos", label: "Mooré" },
  { code: "bm", label: "Bambara" },
  { code: "dje", label: "Zarma" },
  { code: "ee", label: "Éwé" },
  { code: "kbp", label: "Kabiyè" },
  { code: "sar", label: "Sara" },
  { code: "sg", label: "Sängö" },
  { code: "kg", label: "Kikongo" },
  { code: "lua", label: "Cilubà" },
  { code: "fan", label: "Fang" },
  // Autres régions africaines
  { code: "xh", label: "isiXhosa" },
  { code: "af", label: "Afrikaans" },
  { code: "st", label: "Sesotho" },
  { code: "rn", label: "Kirundi" },
  { code: "srr", label: "Sérère" },
  { code: "ht", label: "Créole haïtien" },
  { code: "pap", label: "Papiamento" },
  // Asie & Europe
  { code: "ko", label: "한국어" },
  { code: "tr", label: "Türkçe" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ภาษาไทย" },
  { code: "bn", label: "বাংলা" },
  { code: "tl", label: "Filipino" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "uk", label: "Українська" },
  { code: "pl", label: "Polski" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
];

const LangSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguageSafe();
  const [isTranslating, setIsTranslating] = React.useState(false);

  const handleLanguageChange = (languageCode: string) => {
    setIsTranslating(true);
    setLanguage(languageCode);
    setTimeout(() => setIsTranslating(false), 500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={language}
          onValueChange={handleLanguageChange}
          style={styles.picker}
          enabled={!isTranslating}
        >
          {LANGUAGES.map(({ code, label }) => (
            <Picker.Item key={code} label={label} value={code} />
          ))}
        </Picker>
      </View>
      {isTranslating && (
        <View style={styles.translatingContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.translatingText}>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
    minWidth: 150,
  },
  picker: {
    height: 40,
    fontSize: 14,
  },
  translatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  translatingText: {
    fontSize: 12,
    color: '#2563EB',
  },
});

export default LangSwitcher;
