import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Link } from "@react-navigation/native";

const BienPage = () => {
  return (
    <View style="mb-5">
      <section style="bg-white py-16">
        <View style="">
          <h1 style="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Découvrez nos biens disponibles
          </h1>
          <p style="text-lg md:text-xl text-gray-600 mb-8">
            Trouvez le bien immobilier qui vous correspond grâce à notre sélection intelligente.
          </Text>
          <Link
            to="/recherche"
            style=""
          >
            Commencer la recherche
          </Link>
        </View>
      </section>

      <section style="bg-gray-50 py-16">
        <View style="">
          <View style="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Exemple de carte bien */}
            <View style="bg-white rounded-lg shadow-md overflow-hidden">
              <img
                src="/images/maison1.jpg"
                alt="Maison moderne"
                style="w-full h-48 object-cover"
              />
              <View style="p-4">
                <h3 style="text-xl font-semibold text-gray-800">
                  Maison moderne à Douala
                </h3>
                <p style="text-gray-600 mt-2">
                  3 chambres, 2 salles de bain, quartier sécurisé.
                </Text>
                <Link
                  to="/biens/1"
                  style="mt-4 inline-block text-blue-600 hover:underline font-medium"
                >
                  Voir les détails
                </Link>
              </View>
            </View>

            {/* Ajouter d'autres cartes ici si besoin */}
          </View>
        </View>
      </section>
    </View>
  );
};

export default BienPage;
