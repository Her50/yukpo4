// @ts-nocheck
// src/components/OutilsSection.tsx
import { Text } from 'react-native';
import styles from './services.module.css';
import { useLanguageSafe } from '../contexts/LanguageContext';

function OutilsSection() {
  return (
    <section id="outils" style={styles.sectionContainer}>
      <Text style="text-2xl font-bold mb-4">
        \uD83D\uDEE0️ Outils Yukpo
      </Text>
      <Text style="text-gray-700 text-sm">
        Exploitez les outils Yukpo : contenus intelligents, tendances sociales, prédictions, dashboard.
      </Text>
    </section>
  );
}

export default OutilsSection;





