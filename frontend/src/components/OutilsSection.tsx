// src/components/OutilsSection.tsx
import React from 'react';
import styles from './services.module.css';

function OutilsSection() {
  return (
    <section id="outils" className={styles.sectionContainer}>
      <h2 className="text-2xl font-bold mb-4">
        🛠️ Outils Yukpomnang
      </h2>
      <p className="text-gray-700 text-sm">
        Exploitez les outils Yukpomnang : contenus intelligents, tendances sociales, prédictions, dashboard.
      </p>
    </section>
  );
}

export default OutilsSection;
