// src/components/CreationSection.tsx
import React from 'react';
import { Text } from 'react-native';
import styles from './services.module.css';

function CreationSection() {
  return (
    <section id="creation" style={styles.sectionContainer}>
      <Text style="text-2xl font-bold mb-4">⚙️ Création de service assistée</Text>
      <Text style="text-gray-700 text-sm">
        Yukpomnang vous aide à créer un service complet : texte, image, catégorie, vocal.
      </Text>
    </section>
  );
}

export default CreationSection;





