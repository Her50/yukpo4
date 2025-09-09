// src/components/services/PresentationServiceCard.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface PresentationServiceCardProps {
  icon: string;
  title: string;
  description: string;
  link?: string;
}

const PresentationServiceCard: React.FC<PresentationServiceCardProps> = ({
  icon,
  title,
  description,
  link,
}) => (
  <div>
    <a
      href={link || '#'}
      style={{
        flex: '1 1 30%',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        padding: '24px',
        minWidth: '260px',
        color: '#1a1a1a',
        textDecoration: 'none',
        display: 'block',
        transition: 'transform 0.3s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
    >
      <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
        {icon} {title}
      </h3>
      <p style={{ fontSize: '15px', color: '#444' }}>{description}</p>
    </a>

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

export default PresentationServiceCard;
