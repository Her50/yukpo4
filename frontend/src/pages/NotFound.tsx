// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <ResponsiveContainer>
      <div className="text-center pt-24">
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <p className="mb-4 text-lg text-gray-600">Page introuvable ou indisponible</p>
        <Link to="/" className="text-blue-600 underline">
          Retour à l'accueil
        </Link>
      </div>
    </ResponsiveContainer>
  );
};

export default NotFound;
