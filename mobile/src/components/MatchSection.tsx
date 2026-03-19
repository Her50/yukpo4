// @ts-nocheck
// src/components/MatchSection.tsx
import { Text } from 'react-native';
import styles from './services.module.css';
import { useLanguageSafe } from '../contexts/LanguageContext';

function MatchSection() {
  return (
    <section id="match" style={styles.sectionContainer}>
      <Text style="text-2xl font-bold mb-4">🎯 Mise en relation intelligente</Text>
      <Text style="text-gray-700 text-sm">
        Exprimez un besoin (texte ou vocal), Yukpo vous connecte immédiatement au bon prestataire.
      </Text>
    </section>
  );
}

export default MatchSection;





