// src/components/CreationSection.tsx
import React from 'react';
import styles from './services.module.css';

function CreationSection() {
  return (
    <section id="creation" className={styles.sectionContainer}>
      <h2 className="text-2xl font-bold mb-4">⚙️ Création de service assistée</h2>
      <p className="text-gray-700 text-sm">
        Yukpomnang vous aide à créer un service complet : texte, image, catégorie, vocal.
      </p>
    </section>
  );
}

export default CreationSection;
