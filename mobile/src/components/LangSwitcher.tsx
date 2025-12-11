// src/components/LangSwitcher.tsx
// @ts-check
import { Picker } from '@react-native-picker/picker';
import * as React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
// Note: useTranslation doit être adapté pour React Native ou remplacé
// import { useTranslation } from "@/hooks/useTranslation";

const languages = [
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ar", label: "🇸🇦 العربية" },
  { code: "ff", label: "🌍 Fula" },
];

const LangSwitcher: React.FC = () => {
  // TODO: Adapter useTranslation pour React Native ou utiliser LanguageContext
  const [currentLanguage, setCurrentLanguage] = React.useState("fr");
  const [isTranslating, setIsTranslating] = React.useState(false);

  // Placeholder pour useTranslation
  // const { currentLanguage, isTranslating, changeLanguage } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    setCurrentLanguage(languageCode);
    // changeLanguage(languageCode);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={currentLanguage}
          onValueChange={handleLanguageChange}
          style={styles.picker}
          enabled={!isTranslating}
        >
          {languages.map(({ code, label }) => (
            <Picker.Item key={code} label={label} value={code} />
          ))}
        </Picker>
      </View>
      {isTranslating && (
        <View style={styles.translatingContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.translatingText}>Traduction...</Text>
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





