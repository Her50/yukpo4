// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <ResponsiveContainer>
      <View style="text-center pt-24">
        <h1 style="text-5xl font-bold mb-4">404</h1>
        <p style="mb-4 text-lg text-gray-600">Page introuvable ou indisponible</Text>
        <Link to="/" style="text-blue-600 underline">
          Retour à l'accueil
        </Link>
      </View>
    </ResponsiveContainer>
  );
};

export default NotFound;

