// @ts-nocheck
// src/components/CreationSection.tsx
import { Text } from 'react-native';
import styles from './services.module.css';
import { useLanguageSafe } from '../contexts/LanguageContext';

function CreationSection() {
  return (
    <section id="creation" style={styles.sectionContainer}>
      <Text style="text-2xl font-bold mb-4">{t('creationSection.creationDeServiceAssistee')}</Text>
      <Text style="text-gray-700 text-sm">
        Yukpo vous aide à créer un service complet : texte, image, catégorie, vocal.
      </Text>
    </section>
  );
}

export default CreationSection;





