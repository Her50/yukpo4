// src/components/MatchSection.tsx
import React from 'react';
import styles from './services.module.css';

function MatchSection() {
  return (
    <section id="match" className={styles.sectionContainer}>
      <h2 className="text-2xl font-bold mb-4">🎯 Mise en relation intelligente</h2>
      <p className="text-gray-700 text-sm">
        Exprimez un besoin (texte ou vocal), Yukpomnang vous connecte immédiatement au bon prestataire.
      </p>
    </section>
  );
}

export default MatchSection;
