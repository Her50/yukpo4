// src/components/services/OutilsCard.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

const OutilsCard: React.FC = () => {
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
        Outils Yukpomnang
      </h3>
      <p style={{ fontSize: '15px', color: '#444' }}>
        Utilisez des outils puissants : générateur de texte, prédictions, tableaux de bord, vocal et plus.
      </p>

      {/* 🚀 CONTEXTUAL BUTTONS INTÉGRÉS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
        >
          contacter l'équipe yukpomnang
        </a>
      </div>
    </div>
  );
};

export default OutilsCard;
