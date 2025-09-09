// src/components/services/ProductGrid.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface ProductGridProps {
  onClick: (key: string) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ onClick }) => {
  const products = [
    {
      key: 'match',
      icon: '🎯',
      title: 'Mise en relation intelligente',
      desc: 'Yukpomnang comprend vos besoins et vous connecte instantanément aux bonnes solutions.',
    },
    {
      key: 'creation',
      icon: '⚙️',
      title: 'Création de service assistée',
      desc: 'Lancez votre service rapidement avec du contenu intelligent et un accompagnement vocal.',
    },
    {
      key: 'outils',
      icon: '🛠️',
      title: 'Outils Yukpomnang',
      desc: 'Explorez des outils puissants pour comprendre, anticiper et publier ce que veut votre audience.',
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          padding: '0 20px',
          maxWidth: '1200px',
          margin: '0 auto',
          minHeight: '60vh',
        }}
      >
        {products.map(({ key, icon, title, desc }) => (
          <div
            key={key}
            onClick={() => onClick(key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick(key)}
            style={{
              flex: '1 1 300px',
              maxWidth: '360px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              padding: '24px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
              {icon} {title}
            </h3>
            <p style={{ fontSize: '14px', color: '#444' }}>{desc}</p>
          </div>
        ))}
      </div>

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

export default ProductGrid;
