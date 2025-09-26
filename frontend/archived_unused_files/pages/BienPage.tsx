import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Link } from "react-router-dom";

const BienPage = () => {
  return (
    <div className="mb-5">
      <section className="bg-white py-16">
        <div className="">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Découvrez nos biens disponibles
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            Trouvez le bien immobilier qui vous correspond grâce à notre sélection intelligente.
          </p>
          <Link
            to="/recherche"
            className=""
          >
            Commencer la recherche
          </Link>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Exemple de carte bien */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <img
                src="/images/maison1.jpg"
                alt="Maison moderne"
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  Maison moderne à Douala
                </h3>
                <p className="text-gray-600 mt-2">
                  3 chambres, 2 salles de bain, quartier sécurisé.
                </p>
                <Link
                  to="/biens/1"
                  className="mt-4 inline-block text-blue-600 hover:underline font-medium"
                >
                  Voir les détails
                </Link>
              </div>
            </div>

            {/* Ajouter d'autres cartes ici si besoin */}
          </div>
        </div>
      </section>
    </div>
  );
};

export default BienPage;