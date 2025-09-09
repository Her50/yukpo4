// src/components/services/CreationSection.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

const CreationSection: React.FC = () => {
  return (
    <section style={{ padding: '60px 20px', maxWidth: '900px', margin: '0 auto' }}>
      <h2
        style={{
          fontSize: '26px',
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#1e1e1e',
        }}
      >
        🛠️ Création de service assistée
      </h2>
      <p style={{ fontSize: '16px', color: '#555', marginBottom: '32px' }}>
        Créez votre service en un clic avec l'aide de Yukpomnang : description, image, voix, catégorie.
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
    </section>
  );
};

export default CreationSection;
