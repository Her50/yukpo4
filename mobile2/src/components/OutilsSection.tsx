// src/components/OutilsSection.tsx
import React from 'react';
import { Text } from 'react-native';
import styles from './services.module.css';

function OutilsSection() {
  return (
    <section id="outils" style={styles.sectionContainer}>
      <Text style="text-2xl font-bold mb-4">
        🛠️ Outils Yukpomnang
      </Text>
      <Text style="text-gray-700 text-sm">
        Exploitez les outils Yukpomnang : contenus intelligents, tendances sociales, prédictions, dashboard.
      </Text>
    </section>
  );
}

export default OutilsSection;





