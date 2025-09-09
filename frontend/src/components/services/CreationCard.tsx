// src/components/services/CreationCard.tsx
import React from 'react';

const CreationCard: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        padding: '24px',
        minWidth: '260px',
        maxWidth: '360px',
        flex: '1 1 30%',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>🛠️</div>
      <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        Création de service assistée
      </h3>
      <p style={{ fontSize: '15px', color: '#444' }}>
        Créez un service en un clic : texte, image, catégorie. Yukpomnang vous guide et publie.
      </p>
    </div>
  );
};

export default CreationCard;
